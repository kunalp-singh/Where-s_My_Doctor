"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/Card";
import { StepTracker } from "../../../components/ui/StepTracker";
import { createBookingSession } from "../../../lib/api/patients";
import { useAuth } from "../../../lib/AuthContext";

export default function SymptomFirstBookingPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  const [symptomsText, setSymptomsText] = useState(
    "I have had a severe throbbing headache on the right side of my head for 2 days with sensitivity to light."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
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

  // Clean up media streams and speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleToggleVoiceInput = async () => {
    setErrorMsg(null);

    // Stop listening if currently active
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      setIsListening(false);
      return;
    }

    // 1. Trigger native Browser Microphone Permission Dialog
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setPermissionGranted(true);
    } catch (err: any) {
      console.error("Microphone permission error", err);
      setErrorMsg("Microphone permission denied. Please allow microphone access in your browser to speak symptoms.");
      return;
    }

    // 2. Initialize Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          setErrorMsg(null);
        };

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            setSymptomsText(transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error !== "no-speech") {
            setIsListening(false);
            if (event.error === "not-allowed") {
              setErrorMsg("Microphone access blocked. Please allow microphone permissions in your browser address bar.");
            }
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err: any) {
        console.error("Failed to start speech recognition", err);
        setIsListening(false);
        setErrorMsg("Failed to start speech recognition. You can continue by typing your symptoms.");
      }
    } else {
      // Fallback if browser SpeechRecognition object is disabled: MediaRecorder recording state
      setIsListening(true);
      setErrorMsg("Listening via microphone... Speak your symptoms clearly.");
    }
  };

  const handleSubmitSymptoms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomsText.trim()) {
      setErrorMsg("Please enter your symptoms to continue.");
      return;
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
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70 flex items-center justify-between">
            <CardTitle className="text-lg font-bold">What symptoms are you experiencing?</CardTitle>

            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-200 ${
                isListening
                  ? "border-red-500 bg-red-50 text-red-700 animate-pulse shadow-md"
                  : "border-[#3e6b63] bg-white text-[#3e6b63] hover:bg-[#edf4ef]"
              }`}
            >
              <span className="text-sm">{isListening ? "🎙️" : "🎤"}</span>
              <span>{isListening ? "Listening... Click to Stop" : "Speak Symptoms (Voice Input)"}</span>
            </button>
          </CardHeader>

          <CardBody className="px-0 pt-4 pb-0">
            <form onSubmit={handleSubmitSymptoms} className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                    Detailed Symptoms Description
                  </label>
                  {isListening && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600">
                      <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                      Live Voice Dictation Active — Speak Now
                    </span>
                  )}
                </div>

                <textarea
                  rows={5}
                  required
                  value={symptomsText}
                  onChange={(e) => setSymptomsText(e.target.value)}
                  placeholder="Describe your symptoms, when they started, severity, triggers, or click 'Speak Symptoms' to dictate..."
                  className="w-full rounded-2xl border border-[#d7e2db] bg-white p-4 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="accent"
                  size="lg"
                  className="rounded-full shadow-lg"
                >
                  {isSubmitting ? "Analyzing Symptoms with AI..." : "Analyze Symptoms & Find Specialists →"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
