"""Aggregate per-image / pairwise metrics into a user-facing ``pixel_report`` dict."""

from __future__ import annotations

from statistics import median
from typing import Any


def _m(
    mid: str,
    title: str,
    severity: str,
    detail: str,
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


def build_pixel_report(
    filenames: list[str],
    per_image: list[dict[str, Any] | None],
    pairwise_orb: list[dict[str, Any]],
    iso_by_index: list[int | None] | None = None,
    slot_reports: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Build ``pixel_report`` JSON (versioned) with ``summary``, ``per_image``, ``metrics``.

    ``per_image`` entries align with ``filenames``; ``None`` means decode/analysis failed.
    """
    n = len(filenames)
    metrics: list[dict[str, Any]] = []
    errors: list[str] = []

    if n == 0:
        return {
            "version": 1,
            "summary": {"image_count": 0, "decoded_count": 0},
            "per_image": [],
            "pairwise_orb": pairwise_orb,
            "slot_reports": list(slot_reports or []),
            "metrics": [
                _m("pixel_empty", "Imagens", "info", "Nenhuma imagem na sessão para análise de píxeis."),
            ],
            "error": None,
        }

    ok_idx = [i for i, row in enumerate(per_image) if row is not None]
    if not ok_idx:
        return {
            "version": 1,
            "summary": {"image_count": n, "decoded_count": 0},
            "per_image": [
                {"filename": filenames[i], "error": "decode_failed"} if per_image[i] is None else {}
                for i in range(n)
            ],
            "pairwise_orb": pairwise_orb,
            "slot_reports": list(slot_reports or []),
            "metrics": [
                _m(
                    "pixel_decode",
                    "Imagens para análise de píxeis",
                    "bad",
                    "Não foi possível decodificar nenhuma miniatura JPEG.",
                )
            ],
            "error": "no_decoded_images",
        }

    laps = [float(per_image[i]["laplacian_var_center"]) for i in ok_idx]  # type: ignore[index]
    med_lap = float(median(laps)) if laps else 0.0
    lumas = [float(per_image[i]["mean_luminance_01"]) for i in ok_idx]  # type: ignore[index]
    luma_mean = sum(lumas) / len(lumas)
    luma_std = (sum((x - luma_mean) ** 2 for x in lumas) / len(lumas)) ** 0.5 if lumas else 0.0

    max_clip255 = 0.0
    max_clip0 = 0.0
    worst_clip_name = ""
    for i in ok_idx:
        row = per_image[i]
        assert row is not None
        exp = row["exposure"]
        for ch in ("r", "g", "b"):
            max_clip255 = max(max_clip255, exp[ch]["frac_at_255"])
            max_clip0 = max(max_clip0, exp[ch]["frac_at_0"])
            if exp[ch]["frac_at_255"] >= max_clip255 - 1e-9:
                worst_clip_name = filenames[i]

    # Histogram / clipping
    if max_clip255 > 0.08:
        metrics.append(
            _m(
                "histogram_clip_high",
                "Realces estourados",
                "bad",
                f"Cerca de {max_clip255 * 100:.1f}% dos pixéis atingem branco máximo em pelo menos um canal "
                f"(ex.: {worst_clip_name or '—'}). Reduza exposição ou use tempo de obturador mais rápido.",
                round(max_clip255 * 100, 2),
            )
        )
    elif max_clip255 > 0.02:
        metrics.append(
            _m(
                "histogram_clip_high",
                "Realces perto da saturação",
                "warn",
                f"Até {max_clip255 * 100:.1f}% dos pixéis no canal mais saturado encostam a 255 — atenção a nuvens e reflexos.",
                round(max_clip255 * 100, 2),
            )
        )
    else:
        metrics.append(
            _m(
                "histogram_clip_high",
                "Histograma / realces",
                "ok",
                "Níveis de realce dentro do esperado nas miniaturas analisadas.",
                round(max_clip255 * 100, 3),
            )
        )

    if max_clip0 > 0.12:
        metrics.append(
            _m(
                "histogram_clip_shadow",
                "Sombras esmagadas",
                "warn",
                f"Até {max_clip0 * 100:.1f}% dos pixéis estão em preto mínimo — detalhe nas sombras pode perder-se.",
                round(max_clip0 * 100, 2),
            )
        )

    # Global blur (relative to session)
    low_lap = [filenames[i] for i in ok_idx if float(per_image[i]["laplacian_var_center"]) < max(20.0, 0.28 * med_lap)]  # type: ignore[index]
    if med_lap < 25:
        metrics.append(
            _m(
                "blur_global",
                "Desfocagem global",
                "bad",
                "Variância de Laplaciano muito baixa no conjunto — imagens geralmente desfocadas ou movidas.",
                round(med_lap, 2),
            )
        )
    elif low_lap:
        metrics.append(
            _m(
                "blur_global",
                "Desfocagem em algumas fotos",
                "warn",
                "Desfoque acima do esperado em: "
                + ", ".join(low_lap[:5])
                + ("…" if len(low_lap) > 5 else "")
                + " — reduza velocidade ou aumente o obturador.",
                round(med_lap, 2),
            )
        )
    else:
        metrics.append(
            _m(
                "blur_global",
                "Nitidez global",
                "ok",
                "Nitidez (Laplaciano) consistente no centro do quadro.",
                round(med_lap, 2),
            )
        )

    # Inter-image luminance
    if luma_std > 0.07:
        metrics.append(
            _m(
                "exposure_consistency",
                "Exposição entre fotos",
                "warn",
                f"Variação de luminância média entre fotos (σ≈{luma_std:.3f}) sugere exposição não travada — prefira manual.",
                round(luma_std, 4),
            )
        )
    elif luma_std > 0.04:
        metrics.append(
            _m(
                "exposure_consistency",
                "Exposição entre fotos",
                "info",
                f"Ligeira variação de brilho entre fotos (σ≈{luma_std:.3f}).",
                round(luma_std, 4),
            )
        )
    else:
        metrics.append(
            _m(
                "exposure_consistency",
                "Exposição entre fotos",
                "ok",
                "Brilho médio estável entre as amostras.",
                round(luma_std, 4),
            )
        )

    # Corner softness
    weak_edge = [
        filenames[i]
        for i in ok_idx
        if float(per_image[i]["grid_profile"]["edge_to_center_sharpness_ratio"]) < 0.32  # type: ignore[index]
    ]
    if len(weak_edge) >= max(2, len(ok_idx) // 3):
        metrics.append(
            _m(
                "coverage_edges",
                "Nitidez nas bordas",
                "warn",
                "Várias imagens têm bordas bem mais moles que o centro — verifique foco infinito e vibração.",
            )
        )
    elif weak_edge:
        metrics.append(
            _m(
                "coverage_edges",
                "Nitidez nas bordas",
                "info",
                "Algumas imagens mostram queda de nitidez nas extremidades do quadro.",
            )
        )
    else:
        metrics.append(_m("coverage_edges", "Nitidez local", "ok", "Perfil de nitidez por zona equilibrado."))

    # ORB overlap
    if pairwise_orb:
        ratios = [float(p["match_ratio"]) for p in pairwise_orb]
        mr_med = float(median(ratios))
        if mr_med < 0.015:
            metrics.append(
                _m(
                    "features_orb",
                    "Sobreposição visual (ORB)",
                    "bad",
                    "Pouquíssimas correspondências entre fotos adjacentes — aumente sobreposição frontal ou reduza altitude.",
                    round(mr_med, 4),
                )
            )
        elif mr_med < 0.035:
            metrics.append(
                _m(
                    "features_orb",
                    "Sobreposição visual (ORB)",
                    "warn",
                    "Correspondências ORB moderadas entre pares adjacentes — confirme overlap no plano.",
                    round(mr_med, 4),
                )
            )
        else:
            metrics.append(
                _m(
                    "features_orb",
                    "Sobreposição visual (ORB)",
                    "ok",
                    "Boa densidade de pontos entre fotos consecutivas (ordem por data EXIF).",
                    round(mr_med, 4),
                )
            )
    elif len(ok_idx) >= 2:
        metrics.append(
            _m(
                "features_orb",
                "Sobreposição visual (ORB)",
                "info",
                "Não foi possível estimar overlap entre fotos consecutivas na cronologia (decodes inválidos intercalados).",
            )
        )
    elif len(ok_idx) == 1:
        metrics.append(
            _m(
                "features_orb",
                "Sobreposição visual (ORB)",
                "info",
                "Apenas uma imagem válida para píxeis — overlap ORB não se aplica.",
            )
        )

    # Hot spots
    hot_counts = [int(per_image[i]["hotspots"]["bright_blob_count"]) for i in ok_idx]  # type: ignore[index]
    hot_fracs = [float(per_image[i]["hotspots"]["bright_pixel_frac"]) for i in ok_idx]  # type: ignore[index]
    if max(hot_fracs) > 0.002 and max(hot_counts) >= 2:
        metrics.append(
            _m(
                "hotspots",
                "Reflexos / realces pontuais",
                "warn",
                "Detectados brilhos concentrados (possíveis reflexos). Considere outro horário ou ângulo em relação ao sol.",
                max(hot_counts),
            )
        )
    else:
        metrics.append(_m("hotspots", "Reflexos pontuais", "ok", "Sem padrão forte de hot spots nas miniaturas."))

    # Shadow noise + ISO hint
    high_shadow_std: list[str] = []
    for i in ok_idx:
        row = per_image[i]
        assert row is not None
        sstd = row["shadow"].get("shadow_luma_std")
        if sstd is None:
            continue
        iso = None
        if iso_by_index and i < len(iso_by_index):
            iso = iso_by_index[i]
        if float(sstd) > 24 and (iso is None or iso >= 500):
            high_shadow_std.append(filenames[i])
    if high_shadow_std:
        metrics.append(
            _m(
                "shadow_noise",
                "Ruído em sombras",
                "warn",
                "Elevada variação nas sombras em "
                + ", ".join(high_shadow_std[:4])
                + " — típico de ISO alto ou subexposição; desça ISO se o obturador permitir.",
            )
        )
    else:
        metrics.append(_m("shadow_noise", "Sombras", "ok", "Textura nas sombras dentro do esperado."))

    per_out: list[dict[str, Any]] = []
    for i in range(n):
        row = per_image[i]
        if row is None:
            per_out.append({"filename": filenames[i], "error": "decode_failed"})
            errors.append(filenames[i])
        else:
            slim = {
                "filename": filenames[i],
                "laplacian_var_center": row["laplacian_var_center"],
                "mean_luminance_01": row["mean_luminance_01"],
                "edge_to_center_sharpness_ratio": row["grid_profile"]["edge_to_center_sharpness_ratio"],
                "max_frac_at_255": max(row["exposure"][c]["frac_at_255"] for c in ("r", "g", "b")),
                "orb_match_ratio_prev": None,
            }
            per_out.append(slim)

    for p in pairwise_orb:
        ib = int(p["index_b"])
        if 0 <= ib < len(per_out) and "orb_match_ratio_prev" in per_out[ib]:
            per_out[ib]["orb_match_ratio_prev"] = p["match_ratio"]

    summary = {
        "image_count": n,
        "decoded_count": len(ok_idx),
        "median_laplacian_var": round(med_lap, 3),
        "luminance_std_across_images": round(luma_std, 5),
        "max_channel_frac_at_255": round(max_clip255, 5),
    }

    out: dict[str, Any] = {
        "version": 1,
        "summary": summary,
        "per_image": per_out,
        "pairwise_orb": pairwise_orb,
        "metrics": metrics,
        "slot_reports": list(slot_reports or []),
        "error": None,
    }
    if errors:
        out["partial_decode_errors"] = errors
    return out
