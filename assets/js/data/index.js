// ==========================================================================
// data/index.js — Tüm içeriği birleştiren dizin
// ==========================================================================
import { TREND } from './trend.js';
import { MOMENTUM } from './momentum.js';
import { HACIM } from './hacim.js';
import { VOLATILITE } from './volatilite.js';
import { YAPI } from './yapi.js';

export const DATA = {
  trend: TREND,
  momentum: MOMENTUM,
  hacim: HACIM,
  volatilite: VOLATILITE,
  yapi: YAPI,
};

export const ALL = [...TREND, ...MOMENTUM, ...HACIM, ...VOLATILITE, ...YAPI];

export const TOTAL_COUNT = ALL.length;

export const byId = (id) => ALL.find((x) => x.id === id) || null;

export const listByCat = (catId) => DATA[catId] || [];
