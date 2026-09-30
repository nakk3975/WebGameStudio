import { useState } from "react";

export default function FolderPassword({
  value,
  onChange,
  disabled = false,
  maxLength = 100,
  placeholder = "자료에서 찾은 암호 입력",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <label className="field">
        폴더 암호
        <input
          name="answer"
          aria-label="폴더 암호"
          type={visible ? "text" : "password"}
          required
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          className="code-input"
        />
      </label>
      <label className="check password-visibility">
        <input
          type="checkbox"
          checked={visible}
          disabled={disabled}
          onChange={(e) => setVisible(e.target.checked)}
        />
        암호 표시
      </label>
    </>
  );
}
