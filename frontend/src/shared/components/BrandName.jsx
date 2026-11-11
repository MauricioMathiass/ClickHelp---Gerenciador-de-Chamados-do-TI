/**
 * Nome do sistema com destaque na parte final em maiúsculas
 * ("ClickHELP" -> Click + HELP destacado). Outros nomes aparecem como estão.
 */
function BrandName({ name }) {
  const match = String(name ?? "").match(/^(.+?)([A-Z]{2,})$/);

  if (!match) {
    return name;
  }

  return (
    <>
      {match[1]}
      <span>{match[2]}</span>
    </>
  );
}

export default BrandName;
