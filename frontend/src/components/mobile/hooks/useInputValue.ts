/**
 * useInputValue
 *
 * 受控/非受控输入值管理 hook。
 * 当外部传入 value 时走受控模式，否则内部管理状态。
 */

import { useState, useCallback } from 'react';

export function useInputValue(
  controlledValue: string | undefined,
  controlledOnChange: ((value: string) => void) | undefined,
) {
  const [internalValue, setInternalValue] = useState('');

  const isControlled = controlledValue !== undefined;
  const inputValue = isControlled ? controlledValue : internalValue;

  const setInputValue = useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v);
      controlledOnChange?.(v);
    },
    [isControlled, controlledOnChange],
  );

  return { inputValue, setInputValue };
}
