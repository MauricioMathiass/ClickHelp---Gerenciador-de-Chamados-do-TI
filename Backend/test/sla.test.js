import assert from "node:assert/strict";
import { test } from "node:test";

process.env.TZ = "America/Sao_Paulo";

const { buildSlaLimitFromDate, calculateEasterSunday, isBusinessDay } = await import("../src/lib/sla.js");

const local = (year, month, day, hour = 0, minute = 0) => new Date(year, month - 1, day, hour, minute);

test("calcula a Pascoa corretamente", () => {
  assert.deepEqual(calculateEasterSunday(2026), local(2026, 4, 5));
  assert.deepEqual(calculateEasterSunday(2027), local(2027, 3, 28));
});

test("fins de semana, feriados fixos e Sexta-feira Santa nao sao dias uteis", () => {
  assert.equal(isBusinessDay(local(2026, 11, 14)), false); // sabado
  assert.equal(isBusinessDay(local(2026, 11, 20)), false); // Consciencia Negra
  assert.equal(isBusinessDay(local(2026, 4, 3)), false); // Sexta-feira Santa
  assert.equal(isBusinessDay(local(2026, 11, 10)), true);
});

test("48h uteis contam apenas o expediente das 8h as 18h", () => {
  // Ter 10/11 10h: ter 8h + qua 10h + qui 10h + sex 10h = 38h; sobra 10h -> seg 16/11 18h.
  assert.equal(buildSlaLimitFromDate(local(2026, 11, 10, 10)), local(2026, 11, 16, 18).toISOString());
});

test("abertura fora do expediente comeca a contar no proximo dia util as 8h", () => {
  // Sex 13/11 20h -> conta a partir de seg 16/11 8h; 48h = 4 dias e 8h -> sex 20/11 e feriado,
  // entao: seg, ter, qua, qui (40h) + 8h na seg 23/11 -> 23/11 16h.
  assert.equal(buildSlaLimitFromDate(local(2026, 11, 13, 20)), local(2026, 11, 23, 16).toISOString());
});
