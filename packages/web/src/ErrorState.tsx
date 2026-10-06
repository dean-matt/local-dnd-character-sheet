import { StateCard } from "./StateCard.tsx";

export function ErrorState({ message = "Something went wrong." }: { message?: string }) {
  return (
    <StateCard>
      <p role="alert" className="text-error">
        {message}
      </p>
    </StateCard>
  );
}
