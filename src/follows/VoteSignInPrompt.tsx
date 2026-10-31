/**
 * Shown when a guest taps Vote (spec 04 §4.2). A bottom sheet on phones, a centred
 * dialog from 640px up. Focus-trapped; Esc and "Not now" close it.
 */
import { BottomSheet, Button } from "../components/ui";

interface Props {
  open: boolean;
  candidateName: string;
  onClose: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

export function VoteSignInPrompt({ open, candidateName, onClose, onSignIn, onSignUp }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Sign in to vote for ${candidateName}`}
      footer={
        <div className="vote-prompt__actions">
          <Button onClick={onSignIn}>Sign in</Button>
          <Button variant="secondary" onClick={onSignUp}>
            Create account
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
        </div>
      }
    >
      <p className="vote-prompt__text">
        On NDCConnect, voting means following: it’s free, private and you don’t need to donate.
      </p>
      <p className="vote-prompt__text vote-prompt__text--muted">It isn’t an official ballot.</p>
    </BottomSheet>
  );
}
