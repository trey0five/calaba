import { createContext, useContext, useState, ReactNode } from 'react';

type DialogState =
  | { name: 'consultation' }
  | { name: 'application'; position?: string }
  | { name: 'service'; serviceId: string }
  | { name: 'article'; articleId: string }
  | { name: 'skill'; skillId: string }
  | { name: 'review' }
  | { name: 'teamReview' }
  | null;

interface DialogContextValue {
  state: DialogState;
  setState: (s: DialogState) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

/** One provider drives every modal on the page — only one can be open. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  return (
    <DialogContext.Provider value={{ state, setState }}>{children}</DialogContext.Provider>
  );
}

function useDialogs(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog hooks must be used inside <DialogProvider>');
  return ctx;
}

export function useConsultation() {
  const { state, setState } = useDialogs();
  return {
    open: state?.name === 'consultation',
    openDialog: () => setState({ name: 'consultation' }),
    closeDialog: () => setState(null),
  };
}

export function useApplication() {
  const { state, setState } = useDialogs();
  return {
    open: state?.name === 'application',
    /** role chosen on the careers card, pre-filled in the form */
    position: state?.name === 'application' ? state.position : undefined,
    openDialog: (position?: string) => setState({ name: 'application', position }),
    closeDialog: () => setState(null),
  };
}

export function useReview() {
  const { state, setState } = useDialogs();
  return {
    open: state?.name === 'review',
    openDialog: () => setState({ name: 'review' }),
    closeDialog: () => setState(null),
  };
}

/** Staff review of working here — surfaced from the careers section. */
export function useTeamReview() {
  const { state, setState } = useDialogs();
  return {
    open: state?.name === 'teamReview',
    openDialog: () => setState({ name: 'teamReview' }),
    closeDialog: () => setState(null),
  };
}

export function useArticleDialog() {
  const { state, setState } = useDialogs();
  return {
    open: state?.name === 'article',
    articleId: state?.name === 'article' ? state.articleId : null,
    openArticle: (articleId: string) => setState({ name: 'article', articleId }),
    closeDialog: () => setState(null),
    openConsultation: () => setState({ name: 'consultation' }),
  };
}

export function useSkillDialog() {
  const { state, setState } = useDialogs();
  return {
    open: state?.name === 'skill',
    skillId: state?.name === 'skill' ? state.skillId : null,
    openSkill: (skillId: string) => setState({ name: 'skill', skillId }),
    closeDialog: () => setState(null),
    /** hand off from a skill detail straight into booking */
    openConsultation: () => setState({ name: 'consultation' }),
  };
}

export function useServiceDialog() {
  const { state, setState } = useDialogs();
  return {
    open: state?.name === 'service',
    serviceId: state?.name === 'service' ? state.serviceId : null,
    openService: (serviceId: string) => setState({ name: 'service', serviceId }),
    closeDialog: () => setState(null),
    /** hand off from a service detail straight into booking */
    openConsultation: () => setState({ name: 'consultation' }),
  };
}
