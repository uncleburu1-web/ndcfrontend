/** Leaving the app for the provider's hosted checkout (spec 05 §3.8). A function so tests can stub it. */
export function redirectTo(url: string) {
  window.location.assign(url);
}
