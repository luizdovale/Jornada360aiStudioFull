// Fix: Import `useEffect` to fix 'Cannot find name 'React'' error.
import { useState, useCallback, useEffect } from 'react';

export type ToastProps = {
  id?: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

let count = 0;

function genId() {
  count = (count + 1) % 100;
  return count.toString();
}

type ToasterToast = ToastProps & {
  id: string;
  title: string;
};

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;


let memoryState: { toasts: ToasterToast[] } = { toasts: [] };

const listeners: Array<(state: { toasts: ToasterToast[] }) => void> = [];

function dispatch(action: any) {
    memoryState = reducer(memoryState, action);
    listeners.forEach((listener) => {
        listener(memoryState);
    });
}

const reducer = (state: { toasts: ToasterToast[] }, action: any) => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case 'UPDATE_TOAST':
        return {
            ...state,
            toasts: state.toasts.map((t) => t.id === action.toast.id ? { ...t, ...action.toast } : t),
        }
    case 'DISMISS_TOAST': {
      const { toastId } = action;
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId
            ? { ...t, open: false }
            : t
        ),
      };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    default:
      return state;
  }
};


export function useToast() {
  const [state, setState] = useState(memoryState);

  // Fix: Use `useEffect` directly as it's now imported.
  useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  const toast = useCallback(({ ...props }: ToastProps) => {
    const id = genId();
    const newToast = { ...props, id, open: true };
    dispatch({ type: actionTypes.ADD_TOAST, toast: newToast });

    setTimeout(() => {
        dispatch({ type: actionTypes.REMOVE_TOAST, toastId: id });
    }, TOAST_REMOVE_DELAY);
    
    return {
        id,
        dismiss: () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id }),
        update: (props: ToasterToast) => dispatch({ type: actionTypes.UPDATE_TOAST, toast: { ...props, id }}),
    }

  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}
