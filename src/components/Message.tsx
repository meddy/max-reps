import clsx from "clsx";

import * as styles from "./Message.css";

export interface MessageProps {
  text?: string;
  isLoading?: boolean;
  isError?: boolean;
}

export default function Message(props: MessageProps) {
  const { text, isLoading, isError } = props;
  return (
    <div
      className={clsx({ [styles.error]: isError, [styles.loading]: isLoading })}
    >
      {text
        ? text
        : isLoading
        ? "Loading..."
        : isError
        ? "Something went wrong."
        : ""}
    </div>
  );
}
