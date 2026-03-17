import { ORLANDO_BOUNDING_BOX, TILE_SIZE_METERS } from '../config/cityConfig.js';

const metersToLat = (meters) => meters / 111_320;
const metersToLng = (meters, lat) => meters / (111_320 * Math.cos((lat * Math.PI) / 180));

export function generateOrlandoTiles() {
  const tiles = [];
  const latStep = metersToLat(TILE_SIZE_METERS);

  for (let lat = ORLANDO_BOUNDING_BOX.minLat; lat <= ORLANDO_BOUNDING_BOX.maxLat; lat += latStep) {
    const lngStep = metersToLng(TILE_SIZE_METERS, lat);
    for (let lng = ORLANDO_BOUNDING_BOX.minLng; lng <= ORLANDO_BOUNDING_BOX.maxLng; lng += lngStep) {
      tiles.push({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), radius: 350 });
    }
  }

  return tiles;
}
