import { title, journey, globe, moon, city, fortress, ruins, comet, court, library } from './world.js';
import { earthMeasure, celestial, stars, orbitScene, observatory, tusi } from './sky.js';
import { biruniMeasure } from './biruni.js';
import { kutadgu, sines, rhymes, wings } from './steppe.js';
import { turkmap } from './kashgari.js';
import { navoiScales, ore, translations } from './modern.js';
import { algebra, numerals } from './khwarizmi.js';
import { cipher, optics, nile, laboratory, heart, music, cubic, machine } from './science.js';
import { pi } from './kashi.js';

// Scene ids used in data/films.json.
export const SCENES = {
  title,
  journey,
  globe,
  moon,
  city,
  fortress,
  ruins,
  comet,
  court,
  library,
  'earth-measure': earthMeasure,
  'biruni-measure': biruniMeasure,
  celestial,
  stars,
  orbit: orbitScene,
  observatory,
  tusi,
  algebra,
  numerals,
  cipher,
  optics,
  nile,
  laboratory,
  heart,
  music,
  cubic,
  machine,
  pi,
  kutadgu,
  turkmap,
  sines,
  rhymes,
  wings,
  'navoi-scales': navoiScales,
  ore,
  translations,
};
