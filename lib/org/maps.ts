// Ubicación en Google Maps por organización — no existe un campo de dirección en el modelo todavía,
// así que esto vive solo en el frontend hasta que se agregue de verdad (ver LocationForm/WIP).
// Compartido entre la home del org (mini-mapa) y la tarjeta de resumen de reserva (link "Ver ubicación").
export const ORG_MAPS_LINK: Record<string, string> = {
  aremagol:
    "https://www.google.com/maps/place/La+cuna+del+gol/@10.399095,-75.4703423,17z/data=!4m14!1m7!3m6!1s0x8ef625001a7107c7:0x800bcfd97bf08716!2sLa+cuna+del+gol!8m2!3d10.3990897!4d-75.4677674!16s%2Fg%2F11z76x82xp!3m5!1s0x8ef625001a7107c7:0x800bcfd97bf08716!8m2!3d10.3990897!4d-75.4677674!16s%2Fg%2F11z76x82xp",
};

// Mismas coordenadas del link de arriba, para el mini-mapa embebido (iframe sin necesitar una API
// key de Google Maps — el embed público "output=embed" no la requiere).
export const ORG_MAP_COORDS: Record<string, { lat: number; lng: number }> = {
  aremagol: { lat: 10.3990897, lng: -75.4677674 },
};
