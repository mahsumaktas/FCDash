"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import { useEvent } from "@/hooks/use-event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Settings,
  Zap,
  Shield,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import type { TTSStatus, TTSProviderInfo } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

type VoiceWakeConfig = {
  enabled: boolean;
  keyword?: string;
};

type TalkConfig = {
  enabled?: boolean;
  config?: {
    talk?: {
      voiceId?: string;
      interruptOnSpeech?: boolean;
    };
    session?: unknown;
    ui?: unknown;
  };
};

type ProvidersResult = {
  providers: TTSProviderInfo[];
};

// ── Provider Info Card ───────────────────────────────────────────────────────

function ProviderCard({
  provider,
  isActive,
  onSetActive,
}: {
  provider: TTSProviderInfo;
  isActive: boolean;
  onSetActive: (id: string) => void;
}) {
  const [showVoices, setShowVoices] = useState(false);

  return (
    <Card className={isActive ? "border-primary/40 ring-1 ring-primary/20" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <span>{provider.name}</span>
            {isActive && (
              <Badge className="bg-primary/15 text-primary border-primary/25 text-xs">
                Active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {provider.configured ? (
              <Badge
                variant="outline"
                className="text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
              >
                <CheckCircle2 className="w-3 h-3" />
                Configured
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs bg-red-500/15 text-red-600 border-red-500/25"
              >
                <XCircle className="w-3 h-3" />
                Not Configured
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Feature summary row */}
        <div className="flex flex-wrap gap-1.5">
          {providerFeatures(provider.id).map((feature) => (
            <Badge key={feature} variant="secondary" className="text-xs">
              {feature}
            </Badge>
          ))}
        </div>

        {/* Models */}
        {provider.models && provider.models.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              Models
            </div>
            <div className="flex flex-wrap gap-1">
              {provider.models.map((model) => (
                <Badge key={model} variant="outline" className="text-xs font-mono">
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Voices (expandable) */}
        {provider.voices && provider.voices.length > 0 && (
          <div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              onClick={() => setShowVoices(!showVoices)}
            >
              {showVoices ? "Hide" : "Show"} Voices ({provider.voices.length})
            </button>
            {showVoices && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {provider.voices.map((voice) => (
                  <Badge
                    key={voice}
                    variant="outline"
                    className="text-xs"
                  >
                    {voice}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Set as active button */}
        {!isActive && provider.configured && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetActive(provider.id)}
            className="w-full"
          >
            Set as Active Provider
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function providerFeatures(id: string): string[] {
  const features: Record<string, string[]> = {
    openai: ["Neural voices", "Multiple models", "High quality", "API key required"],
    elevenlabs: ["Cloned voices", "Ultra-realistic", "Multilingual", "API key required"],
    "edge-tts": ["Free", "No API key", "Microsoft voices", "Built-in"],
    edge: ["Free", "No API key", "Microsoft voices", "Built-in"],
  };
  return features[id.toLowerCase()] ?? [];
}

// ── Voice Wake Section ───────────────────────────────────────────────────────

function VoiceWakeSection({
  config,
  onUpdate,
}: {
  config: VoiceWakeConfig;
  onUpdate: (cfg: Partial<VoiceWakeConfig>) => void;
}) {
  const [newKeyword, setNewKeyword] = useState("");

  // The backend uses a single keyword string; display as-is
  const keywords = config.keyword
    ? config.keyword
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const updated = [...keywords, newKeyword.trim()].join(", ");
    onUpdate({ keyword: updated });
    setNewKeyword("");
  };

  const removeKeyword = (kw: string) => {
    const updated = keywords.filter((k) => k !== kw).join(", ");
    onUpdate({ keyword: updated || undefined });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span>Voice Wake</span>
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="wake-toggle"
              className="text-sm text-muted-foreground"
            >
              {config.enabled ? "Enabled" : "Disabled"}
            </Label>
            <Switch
              id="wake-toggle"
              checked={config.enabled}
              onCheckedChange={(enabled: boolean) => onUpdate({ enabled })}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Wake the agent with a keyword. When enabled, the agent listens for the
          trigger word and activates talk mode automatically.
        </p>

        {config.enabled && (
          <>
            <div className="text-xs text-muted-foreground font-medium">
              Trigger Keywords
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No keywords set.
                </span>
              ) : (
                keywords.map((kw) => (
                  <Badge
                    key={kw}
                    variant="secondary"
                    className="text-xs gap-1"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add keyword..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="max-w-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addKeyword();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addKeyword}
                disabled={!newKeyword.trim()}
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function VoicePage() {

  // TTS State
  const [ttsStatus, setTtsStatus] = useState<TTSStatus | null>(null);
  const [ttsLoading, setTtsLoading] = useState(true);
  const [ttsToggling, setTtsToggling] = useState(false);
  const [testText, setTestText] = useState("Hello, this is a test.");
  const [testing, setTesting] = useState(false);

  // Providers (detailed)
  const [providers, setProviders] = useState<TTSProviderInfo[]>([]);

  // Voice Wake
  const [wakeConfig, setWakeConfig] = useState<VoiceWakeConfig>({
    enabled: false,
  });
  const [wakeLoading, setWakeLoading] = useState(true);

  // Talk Mode
  const [talkConfig, setTalkConfig] = useState<TalkConfig>({});
  const [talkLoading, setTalkLoading] = useState(true);
  const [talkToggling, setTalkToggling] = useState(false);

  // STT State
  const [sttActive, setSttActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [sttSupported, setSttSupported] = useState(false);

  // Check STT support
  useEffect(() => {
    const SpeechRecognitionClass =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).SpeechRecognition ??
          (window as unknown as Record<string, unknown>)
            .webkitSpeechRecognition
        : null;
    setSttSupported(!!SpeechRecognitionClass);
  }, []);

  // Fetch TTS status & providers
  const fetchTTS = useCallback(async () => {
    try {
      const [statusRes, providersRes] = await Promise.allSettled([
        api.rpc("tts.status"),
        api.rpc("tts.providers"),
      ]);
      if (statusRes.status === "fulfilled") {
        setTtsStatus(statusRes.value);
      }
      if (providersRes.status === "fulfilled") {
        const res = providersRes.value as ProvidersResult;
        setProviders(res?.providers ?? []);
      }
    } catch {
      // TTS may not be available
    } finally {
      setTtsLoading(false);
    }
  }, []);

  // Fetch voice wake config
  const fetchWake = useCallback(async () => {
    try {
      const result = await api.rpc("voicewake.get");
      setWakeConfig({
        enabled: result?.enabled ?? false,
        keyword: result?.keyword,
      });
    } catch {
      // Voice wake may not be available
    } finally {
      setWakeLoading(false);
    }
  }, []);

  // Fetch talk config
  const fetchTalkConfig = useCallback(async () => {
    try {
      const result = (await api.rpc("talk.config")) as TalkConfig;
      setTalkConfig(result ?? {});
    } catch {
      // Talk mode may not be available
    } finally {
      setTalkLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTTS();
    fetchWake();
    fetchTalkConfig();
  }, [fetchTTS, fetchWake, fetchTalkConfig]);

  // Live updates
  useEvent("voicewake.changed", (payload) => {
    setWakeConfig({
      enabled: payload.enabled,
      keyword: payload.keyword,
    });
  });

  useEvent("talk.mode", (payload) => {
    setTalkConfig((prev) => ({ ...prev, enabled: payload.enabled }));
  });

  // TTS handlers
  const handleTTSToggle = async (enabled: boolean) => {
    setTtsToggling(true);
    try {
      if (enabled) {
        await api.rpc("tts.enable");
      } else {
        await api.rpc("tts.disable");
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
      await api.rpc("tts.setProvider", { provider });
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
      const result = await api.rpc("tts.convert", { text: testText.trim() });
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

  // Talk mode handlers
  const handleTalkModeToggle = async (enabled: boolean) => {
    setTalkToggling(true);
    try {
      await api.rpc("talk.mode", { enabled });
      setTalkConfig((prev) => ({ ...prev, enabled }));
      toast.success(enabled ? "Talk mode enabled" : "Talk mode disabled");
    } catch {
      toast.error("Failed to toggle talk mode");
    } finally {
      setTalkToggling(false);
    }
  };

  // Voice wake handler
  const handleWakeUpdate = async (update: Partial<VoiceWakeConfig>) => {
    const newConfig = { ...wakeConfig, ...update };
    try {
      await api.rpc("voicewake.set", {
        enabled: newConfig.enabled,
        keyword: newConfig.keyword,
      });
      setWakeConfig(newConfig);
      toast.success("Voice wake updated");
    } catch {
      toast.error("Failed to update voice wake");
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

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Voice</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Text-to-speech, speech recognition, voice wake, and talk mode settings
        </p>
      </div>

      {/* ────── TTS Status Card ────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Text-to-Speech
        </h2>

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
          <div className="space-y-4">
            {/* Main TTS control */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span>TTS Settings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="tts-toggle"
                      className="text-sm text-muted-foreground"
                    >
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Current provider */}
                  <div className="space-y-2">
                    <Label>Active Provider</Label>
                    {/* Use providers from detailed list, fall back to ttsStatus.providers */}
                    {(() => {
                      const availableProviders =
                        providers.length > 0
                          ? providers
                          : ttsStatus.providers ?? [];
                      return availableProviders.length > 0 ? (
                        <Select
                          value={ttsStatus.provider || ""}
                          onValueChange={handleProviderChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProviders.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                                {p.configured ? "" : " (not configured)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {ttsStatus.provider ?? "No provider set"}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Current voice */}
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <div className="text-sm">
                      {ttsStatus.voice ?? (
                        <span className="text-muted-foreground">Default</span>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Test synthesis */}
                <div className="space-y-2">
                  <Label>Test Synthesis</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter text to synthesize..."
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleTestSynthesize}
                      disabled={
                        testing || !testText.trim() || !ttsStatus.enabled
                      }
                      size="sm"
                    >
                      {testing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {testing ? "Playing..." : "Play"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provider Cards */}
            {providers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Available Providers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {providers.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      isActive={ttsStatus.provider === provider.id}
                      onSetActive={handleProviderChange}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Provider Comparison Table */}
            {providers.length >= 2 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    Provider Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                            Feature
                          </th>
                          {providers.map((p) => (
                            <th
                              key={p.id}
                              className="text-center py-2 px-3 text-muted-foreground font-medium"
                            >
                              {p.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 pr-4">Configured</td>
                          {providers.map((p) => (
                            <td key={p.id} className="text-center py-2 px-3">
                              {p.configured ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 pr-4">Models</td>
                          {providers.map((p) => (
                            <td
                              key={p.id}
                              className="text-center py-2 px-3 text-muted-foreground"
                            >
                              {p.models?.length ?? 0}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 pr-4">Voices</td>
                          {providers.map((p) => (
                            <td
                              key={p.id}
                              className="text-center py-2 px-3 text-muted-foreground"
                            >
                              {p.voices?.length ?? 0}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 pr-4">API Key Required</td>
                          {providers.map((p) => {
                            const needsKey =
                              p.id.toLowerCase() === "openai" ||
                              p.id.toLowerCase() === "elevenlabs";
                            return (
                              <td
                                key={p.id}
                                className="text-center py-2 px-3"
                              >
                                {needsKey ? (
                                  <Shield className="w-4 h-4 text-amber-500 mx-auto" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Free
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ────── Voice Wake ────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Voice Wake
        </h2>
        {wakeLoading ? (
          <Card>
            <CardContent className="py-6">
              <Skeleton className="h-6 w-48 mb-3" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ) : (
          <VoiceWakeSection config={wakeConfig} onUpdate={handleWakeUpdate} />
        )}
      </div>

      {/* ────── Talk Mode ────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Radio className="w-5 h-5" />
          Talk Mode
        </h2>
        {talkLoading ? (
          <Card>
            <CardContent className="py-6">
              <Skeleton className="h-6 w-48 mb-3" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-muted-foreground" />
                  <span>Talk Mode</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="talk-toggle"
                    className="text-sm text-muted-foreground"
                  >
                    {talkConfig.enabled ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id="talk-toggle"
                    checked={!!talkConfig.enabled}
                    onCheckedChange={handleTalkModeToggle}
                    disabled={talkToggling}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                When talk mode is enabled, the agent responds using voice
                synthesis and listens for voice input, creating a hands-free
                conversational experience. Requires a connected mobile node with
                microphone access.
              </p>

              {talkConfig.enabled && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1" />
                    Active
                  </Badge>
                </div>
              )}

              {talkConfig.config?.talk && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs text-muted-foreground font-medium">
                    Configuration
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {talkConfig.config.talk.voiceId && (
                      <div>
                        <span className="text-muted-foreground">Voice: </span>
                        <span>{talkConfig.config.talk.voiceId}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">
                        Interrupt on speech:{" "}
                      </span>
                      <span>
                        {talkConfig.config.talk.interruptOnSpeech
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ────── Speech-to-Text (Browser) ────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Speech-to-Text
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="w-4 h-4 text-muted-foreground" />
              Browser Speech Recognition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!sttSupported ? (
              <div className="text-center py-6 text-muted-foreground">
                <Mic className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">
                  Browser Speech Recognition API is not supported in this
                  browser.
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
      </div>
    </div>
  );
}
