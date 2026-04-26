import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader, Button } from "@/components/ui";
import {
  DEFAULT_USER_PREFERENCES,
  USER_PREFERENCES_STORAGE_KEY,
  type UserPreferences,
} from "@/constants/userPreferences";
import { useAppContext } from "@/hooks/useAppContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMapEngine } from "@/features/map-engine";
import {
  fetchMapApiKeys,
  updateMapApiKeys,
} from "@/services/mapApiKeysService";

export function SettingsForm() {
  const { workspaceId, setWorkspaceId } = useAppContext();
  const { refreshMapApiKeys } = useMapEngine();
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>(
    USER_PREFERENCES_STORAGE_KEY,
    DEFAULT_USER_PREFERENCES,
  );
  const [showWeatherKey, setShowWeatherKey] = useState(false);
  const [showMapboxKey, setShowMapboxKey] = useState(false);
  const [showGoogleMapsKey, setShowGoogleMapsKey] = useState(false);
  const [mapboxApiKey, setMapboxApiKey] = useState("");
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const [mapKeysSaving, setMapKeysSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMapApiKeys()
      .then((d) => {
        if (cancelled) return;
        setMapboxApiKey(d.mapbox_api_key ?? "");
        setGoogleMapsApiKey(d.google_maps_api_key ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setMapboxApiKey("");
          setGoogleMapsApiKey("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const sanitizedWorkspaceId = useMemo(
    () => workspaceId.trim() || "default",
    [workspaceId],
  );

  const handleWorkspaceBlur = () => {
    if (sanitizedWorkspaceId !== workspaceId) {
      setWorkspaceId(sanitizedWorkspaceId);
    }
  };

  const updatePreferences = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const saveMapApiKeys = async () => {
    setMapKeysSaving(true);
    try {
      await updateMapApiKeys({
        mapbox_api_key: mapboxApiKey.trim() || null,
        google_maps_api_key: googleMapsApiKey.trim() || null,
      });
      await refreshMapApiKeys();
      toast.success("Chaves de mapa salvas no servidor.");
    } catch {
      toast.error("Nao foi possivel salvar as chaves de mapa.");
    } finally {
      setMapKeysSaving(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <Card className="border-[#2e2e2e] bg-[#0f0f0f]/40">
        <CardHeader>
          <h2 className="text-base text-[#fafafa]">Contexto da aplicacao</h2>
          <p className="text-sm text-[#898989]">
            Modo single-tenant sem autenticacao, alinhado ao backend atual.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          <label className="block text-sm text-[#b4b4b4]" htmlFor="workspaceId">
            Workspace ID
          </label>
          <input
            id="workspaceId"
            className="input-base"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            onBlur={handleWorkspaceBlur}
            placeholder="default"
          />
          <p className="text-xs text-[#5c5c5c]">
            Valor usado como contexto de requisicao. Padrao recomendado:
            default.
          </p>
        </CardBody>
      </Card>

      <Card className="border-[#2e2e2e] bg-[#0f0f0f]/40">
        <CardHeader>
          <h2 className="text-base text-[#fafafa]">Preferencias</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm text-[#b4b4b4]">Tema</label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={preferences.theme === "system" ? "primary" : "outline"}
                onClick={() => updatePreferences("theme", "system")}
              >
                Sistema
              </Button>
              <Button
                type="button"
                variant={preferences.theme === "dark" ? "primary" : "outline"}
                onClick={() => updatePreferences("theme", "dark")}
              >
                Escuro
              </Button>
              <Button
                type="button"
                variant={preferences.theme === "light" ? "primary" : "outline"}
                onClick={() => updatePreferences("theme", "light")}
              >
                Claro
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-[#b4b4b4]">
              Unidade de distancia
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={
                  preferences.distanceUnit === "m" ? "primary" : "outline"
                }
                onClick={() => updatePreferences("distanceUnit", "m")}
              >
                Metros (m)
              </Button>
              <Button
                type="button"
                variant={
                  preferences.distanceUnit === "ft" ? "primary" : "outline"
                }
                onClick={() => updatePreferences("distanceUnit", "ft")}
              >
                Pes (ft)
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="block text-sm text-[#b4b4b4]"
              htmlFor="weather-key"
            >
              Chave da API OpenWeatherMap
            </label>
            <div className="flex items-center gap-2">
              <input
                id="weather-key"
                className="input-base"
                type={showWeatherKey ? "text" : "password"}
                value={preferences.openWeatherApiKey}
                onChange={(e) =>
                  updatePreferences("openWeatherApiKey", e.target.value)
                }
                placeholder="Cole sua chave"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowWeatherKey((p) => !p)}
                aria-label={showWeatherKey ? "Ocultar chave" : "Mostrar chave"}
              >
                {showWeatherKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-[#5c5c5c]">
              Usada nas camadas de mapa (vento, nuvens, precipitacao,
              temperatura). O radar de chuva no mapa nao precisa de chave.
            </p>
          </div>

          <div className="space-y-2 border-t border-white/[0.06] pt-4">
            <h3 className="text-sm font-medium text-[#fafafa]">
              Chaves de mapa (servidor)
            </h3>
            <p className="text-xs text-[#5c5c5c]">
              Armazenadas no backend por workspace. Usadas pelo motor de mapas
              (Mapbox / Google) nas proximas fases.
            </p>
            <label
              className="block text-sm text-[#b4b4b4]"
              htmlFor="mapbox-key"
            >
              Mapbox API Key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mapbox-key"
                className="input-base"
                type={showMapboxKey ? "text" : "password"}
                value={mapboxApiKey}
                onChange={(e) => setMapboxApiKey(e.target.value)}
                placeholder="pk.…"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMapboxKey((p) => !p)}
                aria-label={
                  showMapboxKey
                    ? "Ocultar chave Mapbox"
                    : "Mostrar chave Mapbox"
                }
              >
                {showMapboxKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
            <label
              className="block text-sm text-[#b4b4b4]"
              htmlFor="google-maps-key"
            >
              Google Maps API Key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="google-maps-key"
                className="input-base"
                type={showGoogleMapsKey ? "text" : "password"}
                value={googleMapsApiKey}
                onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowGoogleMapsKey((p) => !p)}
                aria-label={
                  showGoogleMapsKey
                    ? "Ocultar chave Google"
                    : "Mostrar chave Google"
                }
              >
                {showGoogleMapsKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="primary"
              disabled={mapKeysSaving}
              onClick={() => void saveMapApiKeys()}
            >
              {mapKeysSaving ? "Salvando…" : "Salvar chaves de mapa"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="border-[#2e2e2e] bg-[#0f0f0f]/40">
        <CardHeader>
          <h2 className="text-base text-[#fafafa]">Sobre</h2>
        </CardHeader>
        <CardBody className="space-y-1 text-sm text-[#898989]">
          <p>DroneData</p>
          <p>Versao: 0.1.0</p>
          <p>Persistencia local de configuracoes ativa.</p>
        </CardBody>
      </Card>
    </div>
  );
}
