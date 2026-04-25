"""Rule-based recommendations from calibration EXIF + pixel reports (Fase 5)."""

from __future__ import annotations

from typing import Any, Literal

from app.services.calibration.spatial_pattern_detector import detect_spatial_patterns

Severity = Literal["info", "warn", "bad"]

_SEV_ORDER = {"ok": 0, "info": 1, "warn": 2, "bad": 3}


def _sev_at_least(a: str, b: str) -> bool:
    return _SEV_ORDER.get(a, 0) >= _SEV_ORDER.get(b, 0)


def _index_metrics(report: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if not report or not isinstance(report, dict):
        return out
    for m in report.get("metrics") or []:
        if not isinstance(m, dict):
            continue
        mid = m.get("id")
        if not mid:
            continue
        key = str(mid)
        prev = out.get(key)
        if prev is None or _sev_at_least(str(m.get("severity", "ok")), str(prev.get("severity", "ok"))):
            out[key] = m
    return out


def _f(summary: dict[str, Any] | None, key: str) -> float | None:
    if not summary:
        return None
    v = summary.get(key)
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _i(summary: dict[str, Any] | None, key: str) -> int | None:
    if not summary:
        return None
    v = summary.get(key)
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _rec(
    rid: str,
    kind: str,
    severity: Severity,
    rationale: str,
    action: str,
    param_changes: list[dict[str, Any]] | None = None,
    affected_slots: list[str] | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": rid,
        "kind": kind,
        "severity": severity,
        "rationale": rationale,
        "text": action,
        "param_changes": param_changes or [],
        "affected_slots": affected_slots or [],
    }
    return row


def build_recommendations(
    params: dict[str, Any] | None,
    weather: dict[str, Any] | None,
    exif_report: dict[str, Any] | None,
    pixel_report: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """
    Produce assistive recommendations with short rationale (metrics → action).

    ``params`` mirrors frontend FlightParams (+ optional ``_calibration``).
    ``weather`` is optional (e.g. ``windSpeedMs``, ``windGustsMs``).
    """
    if not params:
        params = {}
    exif_m = _index_metrics(exif_report)
    pix_m = _index_metrics(pixel_report)
    exif_sum: dict[str, Any] = dict(exif_report.get("summary") or {}) if exif_report else {}
    pix_sum: dict[str, Any] = dict(pixel_report.get("summary") or {}) if pixel_report else {}

    try:
        speed_ms = float(params.get("speedMs"))
    except (TypeError, ValueError):
        speed_ms = None
    try:
        fwd = float(params.get("forwardOverlap"))
    except (TypeError, ValueError):
        fwd = None
    try:
        side = float(params.get("sideOverlap"))
    except (TypeError, ValueError):
        side = None
    try:
        alt_m = float(params.get("altitudeM"))
    except (TypeError, ValueError):
        alt_m = None

    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    def push(r: dict[str, Any]) -> None:
        if r["id"] in seen:
            return
        seen.add(r["id"])
        out.append(r)

    # --- Histogram / clipping + shutter / ND ---
    clip = pix_m.get("histogram_clip_high")
    clip_sev = str(clip.get("severity", "ok")) if clip else "ok"
    max_frac = _f(pix_sum, "max_channel_frac_at_255")
    pct_txt = (
        f"{max_frac * 100:.1f}%"
        if max_frac is not None
        else (clip.get("detail", "realces saturados")[:80] if clip else "saturação nos realces")
    )
    med_exp = _f(exif_sum, "median_exposure_s")
    min_sh = _f(exif_sum, "min_shutter_hint_s")
    med_iso = _i(exif_sum, "median_iso")
    shutter_metric = exif_m.get("shutter_vs_motion")
    shutter_sev = str(shutter_metric.get("severity", "ok")) if shutter_metric else "ok"
    ratio: float | None = None
    if shutter_metric and shutter_metric.get("value") is not None:
        try:
            ratio = float(shutter_metric["value"])
        except (TypeError, ValueError):
            ratio = None
    inferred_ratio = ratio
    if inferred_ratio is None and med_exp is not None and min_sh is not None and min_sh > 0:
        inferred_ratio = med_exp / min_sh

    if clip and _sev_at_least(clip_sev, "warn"):
        shutter_already_tight = (
            med_exp is not None and min_sh is not None and med_exp <= min_sh * 1.45
        )
        iso_base = med_iso is None or med_iso <= 480
        rationale_clip = (
            f"Porque nas miniaturas analisadas {pct_txt} dos pixéis encostam ao branco máximo em pelo menos um canal."
        )
        slow_shutter = _sev_at_least(shutter_sev, "warn") or (
            inferred_ratio is not None and inferred_ratio > 2.2
        )
        if clip_sev == "bad" and shutter_already_tight and iso_base:
            push(
                _rec(
                    "clip_nd",
                    "camera_nd",
                    "info",
                    rationale_clip
                    + " O obturador já está curto em relação à regra GSD÷velocidade e o ISO não está alto.",
                    "Considere filtro ND leve (caso raro): primeiro valide horário e reflexos; o ND só compensa luminância, não corrige outros problemas.",
                )
            )
        elif slow_shutter:
            pc: list[dict[str, Any]] = []
            if speed_ms is not None and speed_ms > 2.5:
                new_speed = round(max(2.5, speed_ms * 0.82), 1)
                pc.append(
                    {
                        "field": "speedMs",
                        "current": speed_ms,
                        "suggested": new_speed,
                        "hint": "Menos velocidade no solo; combine com obturador mais rápido na câmera.",
                    }
                )
            push(
                _rec(
                    "clip_shutter_first",
                    "exposure",
                    "warn" if clip_sev == "warn" else "bad",
                    rationale_clip + " O EXIF indica obturador lento frente ao movimento esperado.",
                    "Aumente a velocidade do obturador na câmera antes de pensar em ND; opcionalmente reduza a velocidade do drone (sugestão aplicável ao plano abaixo).",
                    pc or None,
                )
            )
        else:
            push(
                _rec(
                    "clip_exposure",
                    "exposure",
                    "warn" if clip_sev == "warn" else "bad",
                    rationale_clip,
                    "Reduza a exposição (obturador mais rápido, ISO mais baixo ou abertura mais fechada) e evite superfícies muito claras no enquadramento.",
                )
            )

    # --- Blur / motion ---
    blur = pix_m.get("blur_global")
    blur_sev = str(blur.get("severity", "ok")) if blur else "ok"
    med_lap = _f(pix_sum, "median_laplacian_var")
    if blur and _sev_at_least(blur_sev, "warn"):
        wind_note = ""
        gust = None
        if weather:
            try:
                gust = float(weather.get("windGustsMs") or weather.get("windSpeedMs") or 0)
            except (TypeError, ValueError):
                gust = None
        if gust is not None and gust >= 7:
            wind_note = f" Vento/rajadas ~{gust:.1f} m/s podem agravar vibração e desfoque."
        pc2: list[dict[str, Any]] = []
        if speed_ms is not None and speed_ms > 2.5:
            ns = round(max(2.5, speed_ms * 0.85), 1)
            pc2.append({"field": "speedMs", "current": speed_ms, "suggested": ns, "hint": "Reduz desfoque por movimento do solo."})
        lap_txt = f"variância mediana de Laplaciano ≈ {med_lap:.1f}" if med_lap is not None else "métricas de nitidez baixas"
        push(
            _rec(
                "blur_motion",
                "motion",
                "bad" if blur_sev == "bad" else "warn",
                f"Porque {lap_txt} nas amostras, indicando desfoque global ou tremer.{wind_note}",
                "Aumente o obturador na câmera, reduza a velocidade do drone ou confirme foco infinito; em vento forte, considere adiar o voo.",
                pc2 or None,
            )
        )

    # --- EXIF exposure inconsistency (auto exposure) ---
    exp_c = exif_m.get("exposure_consistency")
    st_exp = _f(exif_sum, "exposure_time_log2_stdev")
    if exp_c and str(exp_c.get("severity", "ok")) == "bad":
        ev_txt = f"σ em log₂(tempo) ≈ {st_exp:.2f}" if st_exp is not None else "alta dispersão entre fotos"
        push(
            _rec(
                "exposure_auto",
                "exposure",
                "warn",
                f"Porque {ev_txt}, típico de exposição automática entre disparos.",
                "Trave ISO, obturador e abertura (modo manual ou semiautomático) para ortomosaico homogêneo.",
            )
        )
    elif st_exp is not None and st_exp > 0.65:
        push(
            _rec(
                "exposure_auto_ev",
                "exposure",
                "warn",
                f"Porque a variação de tempo de exposição entre fotos (σ ≈ {st_exp:.2f} em log₂) passa de ~0,5 EV de dispersão típica.",
                "Prefira exposição manual estável entre todas as fotos da missão.",
            )
        )

    # --- ORB overlap ---
    orb = pix_m.get("features_orb")
    orb_sev = str(orb.get("severity", "ok")) if orb else "ok"
    if orb and _sev_at_least(orb_sev, "warn"):
        pc3: list[dict[str, Any]] = []
        if fwd is not None:
            bump = 10 if orb_sev == "bad" else 5
            new_fwd = min(92.0, fwd + bump)
            if new_fwd > fwd + 0.5:
                pc3.append(
                    {
                        "field": "forwardOverlap",
                        "current": fwd,
                        "suggested": round(new_fwd, 1),
                        "hint": "Mais sobreposição frontal ajuda correspondências entre fotos adjacentes.",
                    }
                )
        if side is not None and orb_sev == "bad" and side < 78:
            pc3.append(
                {
                    "field": "sideOverlap",
                    "current": side,
                    "suggested": min(85.0, round(side + 4.0, 1)),
                    "hint": "Ajuda costura nas bordas entre faixas.",
                }
            )
        if alt_m is not None and alt_m > 35 and orb_sev == "bad":
            new_alt = max(25.0, round(alt_m - 10.0, 1))
            if new_alt + 1 < alt_m:
                pc3.append(
                    {
                        "field": "altitudeM",
                        "current": alt_m,
                        "suggested": new_alt,
                        "hint": "Altitude menor aumenta GSD aparente e overlap relativo ao solo (avalie segurança e regulamento).",
                    }
                )
        mr = None
        if orb.get("value") is not None:
            try:
                mr = float(orb["value"])
            except (TypeError, ValueError):
                mr = None
        rationale_orb = (
            f"Porque a taxa mediana de correspondências ORB entre pares adjacentes ({mr:.4f} se disponível) está abaixo do ideal."
            if mr is not None
            else "Porque poucas correspondências visuais entre fotos adjacentes na sequência temporal."
        )
        push(
            _rec(
                "overlap_orb",
                "overlap",
                "bad" if orb_sev == "bad" else "warn",
                rationale_orb,
                "Aumente a sobreposição frontal e/ou reduza a altitude do plano; confira também velocidade e intervalo de disparo.",
                pc3 or None,
            )
        )

    # --- GPS altitude vs plan ---
    gps = exif_m.get("gps_altitude")
    gps_sev = str(gps.get("severity", "ok")) if gps else "ok"
    if gps and _sev_at_least(gps_sev, "warn"):
        diff = gps.get("value")
        diff_txt = f"Δ ≈ {float(diff):.0f} m" if diff is not None else "diferença relevante"
        push(
            _rec(
                "gps_altitude",
                "navigation",
                "bad" if gps_sev == "bad" else "warn",
                f"Porque a altitude GPS mediana nas fotos difere do plano ({diff_txt}), o que distorce GSD e overlap reais.",
                "Revise o ponto de decolagem e referência de altitude; se o relevo variar, considere modo com seguimento de terreno (terrain follow) no app do drone.",
            )
        )

    # --- Shadow noise + ISO ---
    sh = pix_m.get("shadow_noise")
    sh_sev = str(sh.get("severity", "ok")) if sh else "ok"
    if sh and _sev_at_least(sh_sev, "warn") and (med_iso is None or med_iso >= 400):
        push(
            _rec(
                "shadow_iso",
                "camera_iso",
                "warn",
                f"Porque há alta variação nas sombras nas miniaturas e o ISO mediano nas fotos é {med_iso if med_iso is not None else 'elevado'}.",
                "Reduza o ISO se o obturador ainda permitir, ou planeje voo com mais luz; ISO alto em sombras degrada textura.",
            )
        )

    # --- White balance ---
    wb = exif_m.get("white_balance")
    if wb and str(wb.get("severity", "ok")) == "warn":
        push(
            _rec(
                "white_balance",
                "camera_wb",
                "info",
                "Porque o EXIF indica balanço automático ou misto entre fotos.",
                "Use balanço de brancos fixo ou pré-definido durante toda a missão.",
            )
        )

    # --- Spatial pattern analysis (Fase 5) ---
    slot_reports: list[dict[str, Any]] = []
    if pixel_report and isinstance(pixel_report, dict):
        raw_sr = pixel_report.get("slot_reports")
        if isinstance(raw_sr, list):
            slot_reports = [s for s in raw_sr if isinstance(s, dict)]

    if slot_reports:
        patterns = detect_spatial_patterns(slot_reports)
        for pat in patterns:
            pid = pat.get("type", "spatial")
            axis = pat.get("axis") or ""
            unique_id = f"spatial_{pid}_{axis}"
            if unique_id in seen:
                continue
            conf = float(pat.get("confidence") or 0.0)
            if conf < 0.5:
                continue
            sev: Severity = "bad" if conf >= 0.80 else "warn"
            slot_ids: list[str] = [s for s in (pat.get("affected_slot_ids") or []) if s]
            description = str(pat.get("description") or "")

            ptype = str(pid)
            if ptype == "edge_blur":
                push(_rec(
                    unique_id, "spatial_blur", sev,
                    description,
                    f"Investigue a borda {axis}: verifique sombra, reflexo ou vento lateral. "
                    "Os slots destacados no mapa mostram a área afetada.",
                    affected_slots=slot_ids,
                ))
            elif ptype == "alternating_strips":
                push(_rec(
                    unique_id, "spatial_exposure", sev,
                    description,
                    "Trave exposição manual (ISO, obturador, abertura fixos) antes do voo definitivo.",
                    affected_slots=slot_ids,
                ))
            elif ptype in ("progressive_blur_row", "progressive_blur_col"):
                push(_rec(
                    unique_id, "spatial_blur", sev,
                    description,
                    "Verifique variação de altitude, direção do vento ou posição do sol ao longo do percurso. "
                    "Os slots destacados correspondem às faixas mais afetadas.",
                    affected_slots=slot_ids,
                ))
            elif ptype == "gap_cluster":
                push(_rec(
                    unique_id, "spatial_coverage", sev,
                    description,
                    f"Revise a margem do polígono na borda {axis} ou aumente a área de calibração para cobrir esta região.",
                    affected_slots=slot_ids,
                ))
            elif ptype == "feature_starvation":
                push(_rec(
                    unique_id, "spatial_overlap", sev,
                    description,
                    "Aumente o overlap lateral nesta faixa ou revise o horário para evitar superfícies reflexivas.",
                    affected_slots=slot_ids,
                ))
            else:
                push(_rec(
                    unique_id, "spatial", sev,
                    description,
                    "Revise os slots destacados no mapa para mais contexto.",
                    affected_slots=slot_ids,
                ))

    # --- If nothing actionable but reports exist, short summary ---
    parsed = _i(exif_sum, "parsed_count") or 0
    decoded = _i(pix_sum, "decoded_count") or 0
    if (
        not out
        and (parsed > 0 or decoded > 0)
        and not (exif_report and exif_report.get("error"))
        and not (pixel_report and pixel_report.get("error"))
    ):
        push(
            _rec(
                "all_ok",
                "summary",
                "info",
                "Porque as métricas principais de EXIF e píxeis ficaram dentro dos limiares usados pelo motor de regras.",
                "Nenhum ajuste obrigatório sugerido ao plano; mantenha boas práticas de campo e revise o checklist.",
            )
        )

    return out
