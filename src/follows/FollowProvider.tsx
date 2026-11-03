/**
 * Candidate following — spec 04 §4, §8.1.
 *
 * One shared store of the signed-in user's follow state, so cards, the profile and the
 * Following page stay in step without refetching. Also owns:
 * - the guest sign-in prompt (VoteSignInPrompt) and the pending vote it saves (§4.2);
 * - completing that pending vote once the user is signed in.
 *
 * Follow state is private (spec 04 §7.2): it only ever comes from /me/follows/, never
 * from the cached public candidate endpoints.
 */
import { useAuth } from "@clerk/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, CONSENT_DECLINED } from "../auth/api";
import { useApi } from "../auth/session";
import { useToast } from "../components/ui";
import { clearPendingVote, markPendingVoteFailed, readPendingVote, savePendingVote } from "./pendingVote";
import type { Follow, FollowStates } from "./types";
import { VoteSignInPrompt } from "./VoteSignInPrompt";

/** `{ notify }` = following; `null` = known not following; missing = unknown (treated as not following). */
type Known = { notify: boolean } | null;

const MAX_SLUGS = 50;
const TOO_FAST = "You're doing that too fast. Try again in a minute.";
const GONE = "This candidate is no longer listed.";

export interface FollowOptions {
  /** Where the tap came from: cards get a "View profile" link, since notifications are set there. */
  from?: "card" | "profile" | "following";
  /** Called when the candidate turns out to be unpublished (404), e.g. to reload the profile. */
  onGone?: () => void;
}

interface FollowContextValue {
  signedIn: boolean;
  stateOf: (slug: string) => Known | undefined;
  isFollowing: (slug: string) => boolean;
  notifyOf: (slug: string) => boolean;
  loadStates: (slugs: string[]) => void;
  seed: (follows: Follow[]) => void;
  follow: (slug: string, name: string, options?: FollowOptions) => Promise<void>;
  unfollow: (slug: string, name: string) => Promise<void>;
  setNotify: (slug: string, name: string, on: boolean) => Promise<void>;
  promptSignIn: (slug: string, name: string) => void;
}

const FollowContext = createContext<FollowContextValue | null>(null);

const followPath = (slug: string) => `/me/follows/${encodeURIComponent(slug)}/`;

export function FollowProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const signedIn = Boolean(isLoaded && isSignedIn);
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const [known, setKnown] = useState<Record<string, Known>>({});
  const knownRef = useRef(known);
  knownRef.current = known;
  const [prompt, setPrompt] = useState<{ slug: string; name: string } | null>(null);

  const put = useCallback((slug: string, value: Known) => setKnown((k) => ({ ...k, [slug]: value })), []);

  // Signing out forgets everything: the next person on this device must not see it.
  useEffect(() => {
    if (!signedIn) setKnown({});
  }, [signedIn]);

  const promptSignIn = useCallback((slug: string, name: string) => setPrompt({ slug, name }), []);

  const loadStates = useCallback(
    (slugs: string[]) => {
      if (!signedIn) return;
      const unknown = [...new Set(slugs)].filter((s) => !(s in knownRef.current));
      for (let i = 0; i < unknown.length; i += MAX_SLUGS) {
        const chunk = unknown.slice(i, i + MAX_SLUGS);
        api<FollowStates>(`/me/follows/?slugs=${chunk.map(encodeURIComponent).join(",")}`)
          .then((res) => {
            const following = new Map(res.results.map((r) => [r.slug, r.notify]));
            setKnown((k) => {
              const next = { ...k };
              for (const s of chunk) if (!(s in next)) next[s] = following.has(s) ? { notify: following.get(s)! } : null;
              return next;
            });
          })
          // §11: if states can't load, cards show Vote as not following and stay usable (PUT is idempotent).
          .catch(() => {});
      }
    },
    [api, signedIn]
  );

  const seed = useCallback((follows: Follow[]) => {
    setKnown((k) => {
      const next = { ...k };
      for (const f of follows) if (!(f.candidate.slug in next)) next[f.candidate.slug] = { notify: f.notify };
      return next;
    });
  }, []);

  /** Errors with a specific message (§11). Returns true when handled; the caller then resolves quietly. */
  const handleKnownError = useCallback(
    (err: unknown, slug: string, name: string, onGone?: () => void) => {
      if (!(err instanceof ApiError)) return false;
      if (err.code === CONSENT_DECLINED) return true; // spec 14 §4.2: "Not now" changes nothing, says nothing
      if (err.status === 401) {
        promptSignIn(slug, name);
        return true;
      }
      if (err.status === 429) {
        toast.show({ tone: "warning", message: TOO_FAST });
        return true;
      }
      if (err.status === 404) {
        put(slug, null);
        toast.show({ tone: "warning", message: GONE });
        onGone?.();
        return true;
      }
      return false;
    },
    [promptSignIn, put, toast]
  );

  const follow = useCallback(
    async (slug: string, name: string, options: FollowOptions = {}) => {
      if (!signedIn) {
        promptSignIn(slug, name);
        return;
      }
      try {
        const f = await api<Follow>(followPath(slug), { method: "PUT" });
        put(slug, { notify: f.notify });
        if (options.from === "card") {
          toast.show({
            tone: "success",
            message: `You're following ${name}.`,
            action: { label: "Turn on notifications", onClick: () => navigate(`/candidates/${slug}`) },
          });
        } else {
          toast.show({ tone: "success", message: `You're following ${name}. Turn on notifications to hear when they post.` });
        }
      } catch (err) {
        if (!handleKnownError(err, slug, name, options.onGone)) throw err;
      }
    },
    [api, handleKnownError, navigate, promptSignIn, put, signedIn, toast]
  );

  const unfollow = useCallback(
    async (slug: string, name: string) => {
      try {
        await api<void>(followPath(slug), { method: "DELETE" });
        put(slug, null);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 429)) {
          handleKnownError(err, slug, name);
          return;
        }
        throw err;
      }
    },
    [api, handleKnownError, put]
  );

  const setNotify = useCallback(
    async (slug: string, name: string, on: boolean) => {
      try {
        const f = await api<Follow>(followPath(slug), { method: "PATCH", body: { notify: on } });
        put(slug, { notify: f.notify });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 429 || err.code === CONSENT_DECLINED)) {
          handleKnownError(err, slug, name);
          return;
        }
        throw err;
      }
    },
    [api, handleKnownError, put]
  );

  // Complete a guest's Vote once they're signed in (§4.2). Once per sign-in.
  const attempted = useRef(false);
  useEffect(() => {
    if (!signedIn) {
      attempted.current = false;
      return;
    }
    if (attempted.current) return;
    attempted.current = true;
    const pending = readPendingVote();
    if (!pending) return;
    const { slug, name } = pending;
    api<Follow>(followPath(slug), { method: "PUT" })
      .then((f) => {
        clearPendingVote();
        put(slug, { notify: f.notify });
        const onProfile = pathRef.current === `/candidates/${slug}`;
        toast.show({
          tone: "success",
          message: `You're now following ${name}.`,
          action: onProfile ? undefined : { label: "View profile", onClick: () => navigate(`/candidates/${slug}`) },
        });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          clearPendingVote();
          toast.show({ tone: "warning", message: `${name} is no longer listed, so we couldn't complete your vote.` });
        } else if (pending.tries >= 1) {
          clearPendingVote();
          toast.show({ tone: "error", message: `We couldn't complete your vote for ${name}. Tap Vote on their profile to try again.` });
        } else {
          markPendingVoteFailed(pending); // one more try on the next page load (§11)
        }
      });
  }, [api, navigate, put, signedIn, toast]);

  const goSignIn = () => {
    if (!prompt) return;
    savePendingVote(prompt.slug, prompt.name);
    setPrompt(null);
    navigate(`/sign-in?redirect_url=${encodeURIComponent(`/candidates/${prompt.slug}`)}`);
  };
  const goSignUp = () => {
    if (!prompt) return;
    savePendingVote(prompt.slug, prompt.name);
    setPrompt(null);
    navigate("/sign-up");
  };

  const value = useMemo<FollowContextValue>(
    () => ({
      signedIn,
      stateOf: (slug) => known[slug],
      isFollowing: (slug) => Boolean(known[slug]),
      notifyOf: (slug) => known[slug]?.notify ?? false,
      loadStates,
      seed,
      follow,
      unfollow,
      setNotify,
      promptSignIn,
    }),
    [follow, known, loadStates, promptSignIn, seed, setNotify, signedIn, unfollow]
  );

  return (
    <FollowContext.Provider value={value}>
      {children}
      <VoteSignInPrompt
        candidateName={prompt?.name ?? ""}
        open={prompt !== null}
        onClose={() => setPrompt(null)}
        onSignIn={goSignIn}
        onSignUp={goSignUp}
      />
    </FollowContext.Provider>
  );
}

export function useFollows(): FollowContextValue {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error("useFollows must be used inside <FollowProvider>");
  return ctx;
}
