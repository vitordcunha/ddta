"""Aggregate per-image EXIF into session-level diagnostics (heuristics, no pixels)."""

from __future__ import annotations

import math
import statistics
from datetime import datetime
from typing import Any, Literal

Severity = Literal["ok", "warn", "bad", "info"]


def _median(xs: list[float]) -> float | None:
    if not xs:
        return None
    return float(statistics.median(xs))


def _stdev(xs: list[float]) -> float | None:
    if len(xs) < 2:
        return None
    try:
        return float(statistics.stdev(xs))
    except statistics.StatisticsError:
        return None


def min_shutter_from_gsd_speed(gsd_cm: float | None, speed_ms: float | None) -> float | None:
    """Same rule as frontend `computeMinShutterSuggestion`: GSD(m) / speed."""
    if gsd_cm is None or speed_ms is None:
        return None
    if gsd_cm <= 0 or speed_ms <= 0:
        return None
    gsd_m = gsd_cm / 100.0
    return gsd_m / speed_ms


def _metric(
    mid: str,
    title: str,
    severity: Severity,
    detail: str,
    *,
    value: float | str | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": mid,
        "title": title,
        "severity": severity,
        "detail": detail,
    }
    if value is not None:
        row["value"] = value
    return row


def build_exif_report(
    rows: list[dict[str, Any]],
    params_snapshot: dict[str, Any],
) -> dict[str, Any]:
    """
    rows: list of exif dicts from `extract_calibration_exif` (one per image).
    params_snapshot: flight params; optional `_calibration` with gsdCm, estimatedPhotos, estimatedTimeMin.
    """
    n = len(rows)
    if n == 0:
        return {
            "version": 1,
            "summary": {"image_count": 0, "parsed_count": 0},
            "metrics": [
                _metric("empty", "Imagens", "bad", "Nenhuma imagem encontrada para esta sessão."),
            ],
        }
    valid = [r for r in rows if not r.get("_error")]

    exp_log2 = [float(r["exposure_time_log2"]) for r in valid if r.get("exposure_time_log2") is not None]
    iso_log2 = [float(r["iso_log2"]) for r in valid if r.get("iso_log2") is not None]
    fn_log2 = [float(r["f_number_log2"]) for r in valid if r.get("f_number_log2") is not None]
    exposures = [float(r["exposure_time_s"]) for r in valid if r.get("exposure_time_s")]
    isos = [int(r["iso"]) for r in valid if r.get("iso") is not None]
    alts = [float(r["gps_altitude_m"]) for r in valid if r.get("gps_altitude_m") is not None]

    st_exp = _stdev(exp_log2)
    st_iso = _stdev(iso_log2)
    st_fn = _stdev(fn_log2)

    cal = params_snapshot.get("_calibration") if isinstance(params_snapshot.get("_calibration"), dict) else {}
    gsd_cm = cal.get("gsdCm")
    if gsd_cm is None:
        gsd_cm = params_snapshot.get("gsdCm")
    try:
        gsd_cm_f = float(gsd_cm) if gsd_cm is not None else None
    except (TypeError, ValueError):
        gsd_cm_f = None

    try:
        speed_ms = float(params_snapshot.get("speedMs"))
    except (TypeError, ValueError):
        speed_ms = None

    try:
        plan_alt = float(params_snapshot.get("altitudeM"))
    except (TypeError, ValueError):
        plan_alt = None

    min_shutter = min_shutter_from_gsd_speed(gsd_cm_f, speed_ms)
    med_exp = _median(exposures)

    metrics: list[dict[str, Any]] = []

    # Exposure consistency (log2 exposure time ~ stops between shots)
    if st_exp is not None:
        if st_exp <= 0.35:
            metrics.append(
                _metric(
                    "exposure_consistency",
                    "Exposição (tempo)",
                    "ok",
                    f"Variação baixa entre fotos (σ em log₂(t) ≈ {st_exp:.2f}).",
                    value=st_exp,
                )
            )
        elif st_exp <= 0.65:
            metrics.append(
                _metric(
                    "exposure_consistency",
                    "Exposição (tempo)",
                    "warn",
                    f"Variação moderada (σ ≈ {st_exp:.2f} em log₂ do tempo); comum em automático.",
                    value=st_exp,
                )
            )
        else:
            metrics.append(
                _metric(
                    "exposure_consistency",
                    "Exposição (tempo)",
                    "bad",
                    f"Alta variação (σ ≈ {st_exp:.2f}): considere modo manual com ISO e obturador fixos.",
                    value=st_exp,
                )
            )
    else:
        metrics.append(
            _metric(
                "exposure_consistency",
                "Exposição (tempo)",
                "info",
                "Metadado de tempo de exposição ausente ou insuficiente para medir consistência.",
            )
        )

    if st_iso is not None and st_iso > 0.15:
        sev: Severity = "bad" if st_iso > 0.35 else "warn"
        metrics.append(
            _metric(
                "iso_consistency",
                "ISO",
                sev,
                f"ISO oscila entre fotos (σ em log₂ ≈ {st_iso:.2f}); prefira ISO fixo.",
                value=st_iso,
            )
        )
    elif len(isos) >= 2:
        metrics.append(
            _metric(
                "iso_consistency",
                "ISO",
                "ok",
                "ISO estável entre as amostras.",
            )
        )

    if st_fn is not None and st_fn > 0.08:
        sev = "warn" if st_fn < 0.2 else "bad"
        metrics.append(
            _metric(
                "aperture_consistency",
                "Abertura (f)",
                sev,
                f"Diafragma varia (σ em log₂ f ≈ {st_fn:.2f}); modo totalmente automático?",
                value=st_fn,
            )
        )

    # Shutter vs GSD / speed
    if min_shutter and med_exp:
        ratio = med_exp / min_shutter
        if ratio <= 2.0:
            metrics.append(
                _metric(
                    "shutter_vs_motion",
                    "Obturador vs movimento",
                    "ok",
                    f"Tempo médio ~{med_exp * 1000:.0f} ms perto da regra GSD÷velocidade (~{min_shutter * 1000:.0f} ms).",
                    value=ratio,
                )
            )
        elif ratio <= 4.0:
            metrics.append(
                _metric(
                    "shutter_vs_motion",
                    "Obturador vs movimento",
                    "warn",
                    f"Tempo médio ~{med_exp * 1000:.0f} ms é ~{ratio:.1f}× mais lento que a estimativa mínima (~{min_shutter * 1000:.0f} ms); risco de desfoque por movimento.",
                    value=ratio,
                )
            )
        else:
            metrics.append(
                _metric(
                    "shutter_vs_motion",
                    "Obturador vs movimento",
                    "bad",
                    f"Obturador muito lento (~{ratio:.1f}× acima do mínimo estimado). Aumente velocidade do obturador ou reduza a velocidade do drone.",
                    value=ratio,
                )
            )
    elif min_shutter is None:
        metrics.append(
            _metric(
                "shutter_vs_motion",
                "Obturador vs movimento",
                "info",
                "Sem GSD ou velocidade no snapshot do plano para comparar com o EXIF.",
            )
        )

    # White balance: 0 = auto in EXIF spec for many vendors
    wb_vals: list[int] = []
    for r in valid:
        wb = r.get("white_balance")
        if isinstance(wb, int):
            wb_vals.append(wb)
    if wb_vals:
        autoish = sum(1 for w in wb_vals if w == 0)
        if autoish == len(wb_vals):
            metrics.append(
                _metric(
                    "white_balance",
                    "Balanço de brancos",
                    "warn",
                    "Todas as amostras indicam balanço automático; para orto homogêneo, use WB fixo ou pré-definido.",
                )
            )
        elif autoish == 0:
            metrics.append(
                _metric(
                    "white_balance",
                    "Balanço de brancos",
                    "ok",
                    "Balanço não-automático (ou manual) nas amostras com tag presente.",
                )
            )
        else:
            metrics.append(
                _metric(
                    "white_balance",
                    "Balanço de brancos",
                    "warn",
                    "Mistura de modo automático e fixo entre fotos; evite misturar durante a missão.",
                )
            )

    # GPS altitude vs plan
    med_alt = _median(alts)
    if med_alt is not None and plan_alt is not None:
        diff = abs(med_alt - plan_alt)
        if diff <= 15:
            metrics.append(
                _metric(
                    "gps_altitude",
                    "Altitude GPS vs plano",
                    "ok",
                    f"Mediana GPS ~{med_alt:.0f} m vs plano {plan_alt:.0f} m (Δ {diff:.0f} m).",
                    value=diff,
                )
            )
        elif diff <= 40:
            metrics.append(
                _metric(
                    "gps_altitude",
                    "Altitude GPS vs plano",
                    "warn",
                    f"Mediana GPS ~{med_alt:.0f} m difere do plano ({plan_alt:.0f} m) em ~{diff:.0f} m; confira decolagem / baro / RTK.",
                    value=diff,
                )
            )
        else:
            metrics.append(
                _metric(
                    "gps_altitude",
                    "Altitude GPS vs plano",
                    "bad",
                    f"Grande discrepância (~{diff:.0f} m) entre altitude GPS mediana e plano.",
                    value=diff,
                )
            )
    elif plan_alt is not None:
        metrics.append(
            _metric(
                "gps_altitude",
                "Altitude GPS vs plano",
                "info",
                "Sem altitude GPS nas amostras; não foi possível confrontar com o plano.",
            )
        )

    # Shot interval vs planned overlap (needs calibration stats)
    dts: list[float] = []
    parsed: list[datetime] = []
    for r in valid:
        p = r.get("datetime_original_parsed")
        if not p:
            continue
        try:
            parsed.append(datetime.fromisoformat(p))
        except ValueError:
            continue
    parsed.sort()
    for a, b in zip(parsed, parsed[1:]):
        dts.append((b - a).total_seconds())
    med_dt = _median(dts)

    try:
        est_ph = int(cal["estimatedPhotos"])
        est_min = float(cal["estimatedTimeMin"])
    except (KeyError, TypeError, ValueError):
        est_ph, est_min = 0, 0.0

    if med_dt is not None and est_ph > 1 and est_min > 0:
        expected = (est_min * 60.0) / float(est_ph)
        if expected > 0:
            ratio_i = med_dt / expected
            if 0.5 <= ratio_i <= 2.2:
                metrics.append(
                    _metric(
                        "shot_interval",
                        "Intervalo entre disparos",
                        "ok",
                        f"Mediana ~{med_dt:.1f} s vs ~{expected:.1f} s estimados no trecho de calibração.",
                        value=ratio_i,
                    )
                )
            elif ratio_i <= 4.0:
                metrics.append(
                    _metric(
                        "shot_interval",
                        "Intervalo entre disparos",
                        "warn",
                        f"Intervalo ~{ratio_i:.1f}× o estimado no plano; verifique taxa de disparo ou overlap.",
                        value=ratio_i,
                    )
                )
            else:
                metrics.append(
                    _metric(
                        "shot_interval",
                        "Intervalo entre disparos",
                        "bad",
                        f"Intervalo muito longo (~{ratio_i:.1f}× o esperado); poucas fotos ou missão lenta.",
                        value=ratio_i,
                    )
                )
    elif med_dt is not None:
        metrics.append(
            _metric(
                "shot_interval",
                "Intervalo entre disparos",
                "info",
                f"Mediana entre disparos ~{med_dt:.1f} s (sem estatísticas do plano de calibração para comparar).",
                value=med_dt,
            )
        )

    summary = {
        "image_count": n,
        "parsed_count": len(valid),
        "exposure_time_log2_stdev": st_exp,
        "iso_log2_stdev": st_iso,
        "f_number_log2_stdev": st_fn,
        "median_exposure_s": med_exp,
        "median_iso": int(statistics.median(isos)) if isos else None,
        "median_gps_altitude_m": med_alt,
        "median_shot_interval_s": med_dt,
        "min_shutter_hint_s": min_shutter,
    }

    return {
        "version": 1,
        "summary": summary,
        "metrics": metrics,
    }
