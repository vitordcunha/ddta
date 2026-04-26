from pydantic import BaseModel, ConfigDict, Field


class MapApiKeysResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mapbox_api_key: str | None = None
    google_maps_api_key: str | None = None


class MapApiKeysUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    mapbox_api_key: str | None = Field(default=None, description="Token Mapbox; omitir para não alterar")
    google_maps_api_key: str | None = Field(
        default=None,
        description="Chave Google Maps; omitir para não alterar",
    )
