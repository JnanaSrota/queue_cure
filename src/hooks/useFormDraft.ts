import { useState, useCallback } from "react";

const NAME_KEY = "queuecure-draft-name";
const PHONE_KEY = "queuecure-draft-phone";

function readDraft(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, value: string) {
  try {
    if (value) {
      sessionStorage.setItem(key, value);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorage unavailable — ignore
  }
}

export function useFormDraft() {
  const [inpName, setInpNameState] = useState(() => readDraft(NAME_KEY));
  const [inpPhone, setInpPhoneState] = useState(() => readDraft(PHONE_KEY));

  const setInpName = useCallback((value: string) => {
    setInpNameState(value);
    writeDraft(NAME_KEY, value);
  }, []);

  const setInpPhone = useCallback((value: string) => {
    setInpPhoneState(value);
    writeDraft(PHONE_KEY, value);
  }, []);

  const clearDraft = useCallback(() => {
    setInpNameState("");
    setInpPhoneState("");
    writeDraft(NAME_KEY, "");
    writeDraft(PHONE_KEY, "");
  }, []);

  return { inpName, inpPhone, setInpName, setInpPhone, clearDraft };
}
