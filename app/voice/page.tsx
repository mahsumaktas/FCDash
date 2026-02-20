"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Volume2,
  Mic,
  Radio,
  Play,
  Square,
  WifiOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { TTSStatus } from "@/lib/types";

export default function VoicePage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  // TTS State
  const [ttsStatus, setTtsStatus] = useState<TTSStatus | null>(null);
  const [ttsLoading, setTtsLoading] = useState(true);
  const [ttsToggling, setTtsToggling] = useState(false);
  const [testText, setTestText] = useState("Hello, this is a test.");
  const [testing, setTesting] = useState(false);

  // STT State
  const [sttActive, setSttActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [sttSupported, setSttSupported] = useState(false);

  // Talk Mode State
  const [talkEnabled, setTalkEnabled] = useState(false);
  const [talkLoading, setTalkLoading] = useState(true);
  const [talkToggling, setTalkToggling] = useState(false);

  // Check STT support
  useEffect(() => {
    const SpeechRecognitionClass =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).SpeechRecognition ??
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition
        : null;
    setSttSupported(!!SpeechRecognitionClass);
  }, []);

  // Fetch TTS status
  const fetchTTS = useCallback(async () => {
    if (!isConnected) return;
    try {
      const status = await rpc("tts.status");
      setTtsStatus(status);
    } catch {
      // TTS may not be available
    } finally {
      setTtsLoading(false);
    }
  }, [isConnected, rpc]);

  // Fetch talk mode status
  const fetchTalkMode = useCallback(async () => {
    if (!isConnected) return;
    try {
      const config = await rpc("talk.config") as Record<string, unknown>;
      setTalkEnabled(!!config?.enabled);
    } catch {
      // Talk mode may not be available
    } finally {
      setTalkLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchTTS();
    fetchTalkMode();
  }, [fetchTTS, fetchTalkMode]);

  // TTS handlers
  const handleTTSToggle = async (enabled: boolean) => {
    setTtsToggling(true);
    try {
      if (enabled) {
        await rpc("tts.enable");
      } else {
        await rpc("tts.disable");
      }
      setTtsStatus((prev) => (prev ? { ...prev, enabled } : null));
      toast.success(enabled ? "TTS enabled" : "TTS disabled");
    } catch {
      toast.error("Failed to toggle TTS");
    } finally {
      setTtsToggling(false);
    }
  };

  const handleProviderChange = async (provider: string) => {
    try {
      await rpc("tts.setProvider", { provider });
      toast.success(`TTS provider set to ${provider}`);
      fetchTTS();
    } catch {
      toast.error("Failed to change provider");
    }
  };

  const handleTestSynthesize = async () => {
    if (!testText.trim()) return;
    setTesting(true);
    try {
      const result = await rpc("tts.convert", { text: testText.trim() });
      if (result.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${result.audio}`);
        audio.play();
        toast.success("Playing synthesized audio");
      }
    } catch {
      toast.error("Synthesis failed");
    } finally {
      setTesting(false);
    }
  };

  // STT handlers
  const startSTT = () => {
    const SpeechRecognitionClass =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognitionClass as any)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = () => {
      toast.error("Speech recognition error");
      setSttActive(false);
    };

    recognition.onend = () => {
      setSttActive(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setSttActive(true);
    setTranscript("");
  };

  const stopSTT = () => {
    recognitionRef.current?.stop();
    setSttActive(false);
  };

  // Talk mode handler
  const handleTalkModeToggle = async (enabled: boolean) => {
    setTalkToggling(true);
    try {
      await rpc("talk.mode", { enabled });
      setTalkEnabled(enabled);
      toast.success(enabled ? "Talk mode enabled" : "Talk mode disabled");
    } catch {
      toast.error("Failed to toggle talk mode");
    } finally {
      setTalkToggling(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Not Connected</h2>
        <p className="text-sm">Waiting for gateway connection...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Voice</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Text-to-speech, speech-to-text, and talk mode settings
        </p>
      </div>

      <Tabs defaultValue="tts">
        <TabsList>
          <TabsTrigger value="tts">
            <Volume2 className="w-4 h-4" />
            TTS
          </TabsTrigger>
          <TabsTrigger value="stt">
            <Mic className="w-4 h-4" />
            STT
          </TabsTrigger>
          <TabsTrigger value="talk">
            <Radio className="w-4 h-4" />
            Talk Mode
          </TabsTrigger>
        </TabsList>

        {/* TTS Tab */}
        <TabsContent value="tts" className="space-y-4 mt-4">
          {ttsLoading ? (
            <Card>
              <CardContent className="py-6">
                <Skeleton className="h-6 w-48 mb-3" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ) : !ttsStatus ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground">
                <Volume2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">TTS not available on this gateway.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Text-to-Speech</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tts-toggle" className="text-sm text-muted-foreground">
                        {ttsStatus.enabled ? "Enabled" : "Disabled"}
                      </Label>
                      <Switch
                        id="tts-toggle"
                        checked={ttsStatus.enabled}
                        onCheckedChange={handleTTSToggle}
                        disabled={ttsToggling}
                      />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Provider selector */}
                  {ttsStatus.providers && ttsStatus.providers.length > 0 && (
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select
                        value={ttsStatus.provider || ""}
                        onValueChange={handleProviderChange}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {ttsStatus.providers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              {p.configured ? "" : " (not configured)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {ttsStatus.voice && (
                    <div className="text-sm text-muted-foreground">
                      Voice: <span className="text-foreground">{ttsStatus.voice}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Test synthesis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Test Synthesis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Enter text to synthesize..."
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                  />
                  <Button
                    onClick={handleTestSynthesize}
                    disabled={testing || !testText.trim() || !ttsStatus.enabled}
                    size="sm"
                  >
                    {testing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {testing ? "Synthesizing..." : "Play"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* STT Tab */}
        <TabsContent value="stt" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Speech-to-Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!sttSupported ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Mic className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">
                    Browser Speech Recognition API is not supported in this browser.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={sttActive ? stopSTT : startSTT}
                      variant={sttActive ? "destructive" : "default"}
                    >
                      {sttActive ? (
                        <>
                          <Square className="w-4 h-4" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          Start Listening
                        </>
                      )}
                    </Button>
                    {sttActive && (
                      <Badge className="bg-red-500 hover:bg-red-500 text-white animate-pulse">
                        Recording
                      </Badge>
                    )}
                  </div>

                  {/* Transcript display */}
                  <div className="min-h-[100px] rounded-md border bg-muted/30 p-4">
                    {transcript ? (
                      <p className="text-sm whitespace-pre-wrap">{transcript}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {sttActive
                          ? "Listening... Speak now."
                          : "Transcript will appear here."}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Talk Mode Tab */}
        <TabsContent value="talk" className="space-y-4 mt-4">
          {talkLoading ? (
            <Card>
              <CardContent className="py-6">
                <Skeleton className="h-6 w-48 mb-3" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Talk Mode</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="talk-toggle" className="text-sm text-muted-foreground">
                      {talkEnabled ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                      id="talk-toggle"
                      checked={talkEnabled}
                      onCheckedChange={handleTalkModeToggle}
                      disabled={talkToggling}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  When talk mode is enabled, the agent will respond using voice synthesis
                  and listen for voice input, creating a hands-free conversational experience.
                </p>
                {talkEnabled && (
                  <Badge className="mt-3 bg-emerald-600 hover:bg-emerald-600 text-white">
                    Active
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
