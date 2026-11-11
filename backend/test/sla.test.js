import assert from "node:assert/strict";
import { test } from "node:test";

process.env.TZ = "America/Sao_Paulo";

const { buildSlaLimitFromDate, calculateEasterSunday, createCalendar } =
  await import("../src/modules/tickets/sla.js");

const local = (year, month, day, hour = 0, minute = 0) => new Date(year, month - 1, day, hour, minute);
const padrao = createCalendar();

test("calcula a Pascoa corretamente", () => {
  assert.deepEqual(calculateEasterSunday(2026), local(2026, 4, 5));
  assert.deepEqual(calculateEasterSunday(2027), local(2027, 3, 28));
});

test("fins de semana, feriados nacionais e Sexta-feira Santa nao sao dias uteis", () => {
  assert.equal(padrao.isBusinessDay(local(2026, 11, 14)), false); // sabado
  assert.equal(padrao.isBusinessDay(local(2026, 11, 20)), false); // Consciencia Negra
  assert.equal(padrao.isBusinessDay(local(2026, 4, 3)), false); // Sexta-feira Santa
  assert.equal(padrao.isBusinessDay(local(2026, 11, 10)), true);
});

test("48h uteis contam apenas o expediente das 8h as 18h", () => {
  // Ter 10/11 10h: ter 8h + qua 10h + qui 10h + sex 10h = 38h; sobra 10h -> seg 16/11 18h.
  assert.equal(
    buildSlaLimitFromDate(local(2026, 11, 10, 10), 48, padrao),
    local(2026, 11, 16, 18).toISOString()
  );
});

test("abertura fora do expediente comeca a contar no proximo dia util as 8h", () => {
  // Sex 13/11 20h -> seg 16/11 8h; seg a qui (40h) + 8h na seg 23/11 (20/11 e feriado) -> 23/11 16h.
  assert.equal(
    buildSlaLimitFromDate(local(2026, 11, 13, 20), 48, padrao),
    local(2026, 11, 23, 16).toISOString()
  );
});

test("abertura no fim de semana comeca no proximo dia util", () => {
  // Sab 14/11 10h -> seg 16/11 8h + 2h = 10h.
  assert.equal(
    buildSlaLimitFromDate(local(2026, 11, 14, 10), 2, padrao),
    local(2026, 11, 16, 10).toISOString()
  );
});

test("expediente, dias uteis e feriados configuraveis", () => {
  const calendario = createCalendar({
    workStartHour: 9,
    workEndHour: 13,
    workDays: [1, 2, 3, 4, 5, 6],
    holidays: { national: false, movable: ["carnaval", "corpus-christi"], extra: ["01-25"] },
  });

  assert.equal(calendario.isBusinessDay(local(2026, 11, 14)), true); // sabado vira dia util
  assert.equal(calendario.isBusinessDay(local(2026, 11, 20)), true); // nacionais desligados
  assert.equal(calendario.isBusinessDay(local(2027, 2, 8)), false); // Carnaval 2027
  assert.equal(calendario.isBusinessDay(local(2027, 5, 27)), false); // Corpus Christi 2027
  assert.equal(calendario.isBusinessDay(local(2027, 1, 25)), false); // feriado extra

  // Sex 13/11 12h: 1h na sexta (12-13) + 4h no sabado (9-13) + 1h na segunda -> seg 16/11 10h.
  assert.equal(
    buildSlaLimitFromDate(local(2026, 11, 13, 12), 6, calendario),
    local(2026, 11, 16, 10).toISOString()
  );
});
