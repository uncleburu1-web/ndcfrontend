/**
 * Shown when a guest taps Vote (spec 04 §4.2). A bottom sheet on phones, a centred
 * dialog from 640px up. Focus-trapped; Esc and "Not now" close it.
 */
import { BottomSheet, Button } from "../components/ui";
import { t } from "../i18n";

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
      title={t("follows.sign-in-to-vote-for", { candidateName })}
      footer={
        <div className="vote-prompt__actions">
          <Button onClick={onSignIn}>{t("follows.sign-in")}</Button>
          <Button variant="secondary" onClick={onSignUp}>
            {t("follows.create-account")}</Button>
          <Button variant="ghost" onClick={onClose}>
            {t("follows.not-now")}</Button>
        </div>
      }
    >
      <p className="vote-prompt__text">
        {t("follows.on-ndcconnect-voting-means-following-it")}</p>
      <p className="vote-prompt__text vote-prompt__text--muted">{t("follows.it-isn-t-an-official-ballot")}</p>
    </BottomSheet>
  );
}
