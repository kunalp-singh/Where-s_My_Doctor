"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/Card";
import { StepTracker } from "../../../components/ui/StepTracker";
import { createBookingSession, transcribeAudioSymptoms } from "../../../lib/api/patients";
import { useAuth } from "../../../lib/AuthContext";

export default function SymptomFirstBookingPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  const [symptomsText, setSymptomsText] = useState(
    "I have had a severe throbbing headache on the right side of my head for 2 days with sensitivity to light."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "patient") {
        router.push("/");
      }
    }
  }, [authStatus, user, router]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const processAudio = async (audioBlob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMsg(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        try {
          const res = await transcribeAudioSymptoms(base64Audio, mimeType);
          if (res.transcript && res.transcript.trim()) {
            setSymptomsText(res.transcript.trim());
          }
        } catch (err: any) {
          console.error("Transcription error", err);
          setErrorMsg("Could not transcribe voice audio. Please try again or type your symptoms.");
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err: any) {
      console.error("Audio processing error", err);
      setIsTranscribing(false);
    }
  };

  const handleStopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    } else if (audioChunksRef.current.length > 0) {
      const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: mime });
      processAudio(audioBlob, mime);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    setIsListening(false);
  };

  const handleToggleVoiceInput = async () => {
    setErrorMsg(null);

    if (isListening) {
      handleStopListening();
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch (err: any) {
      console.error("Microphone error", err);
      setErrorMsg("Microphone permission denied. Please allow microphone access in your browser.");
      return;
    }

    setSymptomsText("");
    audioChunksRef.current = [];

    try {
      const options = MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? { mimeType: "audio/mp4" }
        : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        if (audioBlob.size > 0) {
          processAudio(audioBlob, mime);
        }
      };

      mediaRecorder.start(250);
      setIsListening(true);
    } catch (err) {
      console.error("MediaRecorder start error", err);
    }
  };

  const handleSubmitSymptoms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomsText.trim()) {
      setErrorMsg("Please enter your symptoms to continue.");
      return;
    }
    if (isListening) {
      handleStopListening();
    }
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const session = await createBookingSession(symptomsText);
      router.push(`/patient/book/${session.sessionId}/doctors`);
    } catch (err: any) {
      console.error("Error starting booking session", err);
      setErrorMsg(err.message || "Failed to analyze symptoms. Please try again.");
      setIsSubmitting(false);
    }
  };

  const steps = [
    { label: "1. Symptoms", active: true },
    { label: "2. Choose Specialist", active: false },
    { label: "3. Choose Time Slot", active: false },
    { label: "4. Confirm", active: false },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-6">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#3e6b63]">
              Step 1 of 4
            </span>
            <h1 className="text-3xl font-black text-[#21322a]">
              Describe Your Symptoms
            </h1>
            <p className="text-xs text-[#587066]">
              Our AI care assistant will analyze your symptoms and suggest the most relevant medical specialist for your visit.
            </p>
          </div>

          <StepTracker steps={steps} />
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 animate-in fade-in">
            {errorMsg}
          </div>
        )}

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70">
            <CardTitle className="text-lg font-bold">What symptoms are you experiencing?</CardTitle>
          </CardHeader>

          <CardBody className="px-0 pt-4 pb-0">
            <form onSubmit={handleSubmitSymptoms} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f] mb-2">
                  Detailed Symptoms Description
                </label>

                {/* Textarea with Minimal Mic & Stop Controls */}
                <div className="relative">
                  <textarea
                    rows={5}
                    required
                    value={symptomsText}
                    onChange={(e) => setSymptomsText(e.target.value)}
                    placeholder={
                      isTranscribing
                        ? "Transcribing voice audio..."
                        : "Describe your symptoms, or tap the microphone icon to record..."
                    }
                    className={`w-full rounded-2xl border bg-white p-4 text-sm outline-none transition-all duration-200 ${
                      isListening
                        ? "border-red-400 ring-2 ring-red-400/40 pr-32"
                        : "border-[#d7e2db] pr-14 focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
                    }`}
                  />

                  {/* Right Corner Minimal Controls */}
                  <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5">
                    {/* Stop Button when Recording */}
                    {isListening && (
                      <button
                        type="button"
                        onClick={handleStopListening}
                        className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-red-700 transition"
                      >
                        ⏹ Stop
                      </button>
                    )}

                    {/* Microphone Icon Button */}
                    <button
                      type="button"
                      disabled={isTranscribing}
                      onClick={handleToggleVoiceInput}
                      title={isListening ? "Stop recording" : "Record symptoms with mic"}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 ${
                        isListening
                          ? "border-red-500 bg-red-100 text-red-600 animate-pulse shadow-md scale-105"
                          : isTranscribing
                          ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "border-[#d7e2db] bg-[#f9f7f1] text-[#3e6b63] hover:border-[#3e6b63] hover:bg-[#3e6b63] hover:text-white"
                      }`}
                    >
                      {isTranscribing ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3e6b63] border-t-transparent" />
                      ) : (
                        <span className="text-base">{isListening ? "🎙️" : "🎤"}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting || isTranscribing}
                  variant="accent"
                  size="lg"
                  className="rounded-full shadow-lg"
                >
                  {isSubmitting
                    ? "Analyzing Symptoms with AI..."
                    : isTranscribing
                    ? "Transcribing..."
                    : "Analyze Symptoms & Find Specialists →"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
