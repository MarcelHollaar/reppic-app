"use client";

import { createContext, FC, ReactNode, useContext, useState } from "react";

interface AudioRecorderContextType {
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
}

interface AudioRecorderProviderProps {
  children: ReactNode;
}

const AudioRecorderContext = createContext<
  AudioRecorderContextType | undefined
>(undefined);

export const AudioRecorderProvider: FC<AudioRecorderProviderProps> = ({
  children,
}) => {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <AudioRecorderContext.Provider
      value={{
        isRecording,
        setIsRecording,
      }}
    >
      {children}
    </AudioRecorderContext.Provider>
  );
};

export const useAudioRecorderContext = () => {
  const context = useContext(AudioRecorderContext);

  if (context === undefined) {
    throw new Error(
      "useAudioRecorderContext must be used within an AudioRecorderProvider"
    );
  }

  return context;
};
