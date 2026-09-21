export default function HomePage() {
  return (
    <main>
      <h1>PrimeTime</h1>
      <p>
        The hosted web UI (connect GitHub, pick repositories, view primer status) is not built
        yet. This deployment currently only serves the GitHub App webhook and Actions OIDC
        token-exchange API routes under <code>/api/github/webhook</code> and{" "}
        <code>/api/actions/token</code>.
      </p>
    </main>
  );
}
