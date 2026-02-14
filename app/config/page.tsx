'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Save, RotateCcw, CheckCircle } from 'lucide-react';

interface Config {
  prompts: { [key: string]: string };
  thresholds: {
    arvSpreadMin: number;
    ltvMax: number;
    wholesaleMargin: number;
  };
  messageTemplates: {
    cashOffer: string;
    sellerFinancing: string;
    subjectTo: string;
  };
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;

    setLoading(true);
    setSaveStatus('Saving...');

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const data = await response.json();

      if (data.success) {
        setSaveStatus('✓ Configuration saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(`✗ Save failed: ${data.error}`);
      }
    } catch (error: any) {
      setSaveStatus(`✗ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function resetConfig() {
    if (!confirm('Are you sure you want to reset all configuration to defaults?')) {
      return;
    }

    setLoading(true);
    setSaveStatus('Resetting...');

    try {
      const response = await fetch('/api/config', {
        method: 'PUT'
      });

      const data = await response.json();

      if (data.success) {
        setConfig(data.config);
        setSaveStatus('✓ Configuration reset to defaults!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(`✗ Reset failed: ${data.error}`);
      }
    } catch (error: any) {
      setSaveStatus(`✗ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return <div>Failed to load configuration</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Configuration</h1>
          <p className="text-muted-foreground">
            Customize evaluation prompts, thresholds, and message templates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetConfig} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={saveConfig} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>

      {saveStatus && (
        <Card className={`mb-6 ${saveStatus.includes('✗') ? 'border-destructive' : 'border-green-600'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {saveStatus.includes('✓') && <CheckCircle className="h-5 w-5 text-green-600" />}
              <p className="text-sm">{saveStatus}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="prompts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prompts">Evaluation Prompts</TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="messages">Message Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Prompts</CardTitle>
              <CardDescription>
                AI prompts used for different search types. The AI uses these to analyze properties.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(config.prompts).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-2 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <textarea
                    className="w-full min-h-[100px] p-3 bg-background border rounded-md"
                    value={value}
                    onChange={(e) => setConfig({
                      ...config,
                      prompts: { ...config.prompts, [key]: e.target.value }
                    })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thresholds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Math Thresholds</CardTitle>
              <CardDescription>
                Numeric thresholds used for property routing and qualification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Minimum ARV Spread % (Fix & Flip threshold)
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-background border rounded-md"
                  value={config.thresholds.arvSpreadMin}
                  onChange={(e) => setConfig({
                    ...config,
                    thresholds: { ...config.thresholds, arvSpreadMin: Number(e.target.value) }
                  })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Properties with ARV spread above this % are routed to Fix & Flip
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Maximum LTV % (Financing cutoff)
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-background border rounded-md"
                  value={config.thresholds.ltvMax}
                  onChange={(e) => setConfig({
                    ...config,
                    thresholds: { ...config.thresholds, ltvMax: Number(e.target.value) }
                  })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  LTV above this triggers Subject To, below 50% triggers Seller Financing
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Wholesale Margin %
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-background border rounded-md"
                  value={config.thresholds.wholesaleMargin}
                  onChange={(e) => setConfig({
                    ...config,
                    thresholds: { ...config.thresholds, wholesaleMargin: Number(e.target.value) }
                  })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Markup percentage for wholesale price calculation
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Outreach Message Templates</CardTitle>
              <CardDescription>
                Message templates used for different financing strategies. Use {'{address}'}, {'{cashOffer}'}, {'{arv}'}, {'{notes}'} as placeholders.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cash Offer Template
                </label>
                <textarea
                  className="w-full min-h-[100px] p-3 bg-background border rounded-md font-mono text-sm"
                  value={config.messageTemplates.cashOffer}
                  onChange={(e) => setConfig({
                    ...config,
                    messageTemplates: { ...config.messageTemplates, cashOffer: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Seller Financing Template
                </label>
                <textarea
                  className="w-full min-h-[100px] p-3 bg-background border rounded-md font-mono text-sm"
                  value={config.messageTemplates.sellerFinancing}
                  onChange={(e) => setConfig({
                    ...config,
                    messageTemplates: { ...config.messageTemplates, sellerFinancing: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Subject To Template
                </label>
                <textarea
                  className="w-full min-h-[100px] p-3 bg-background border rounded-md font-mono text-sm"
                  value={config.messageTemplates.subjectTo}
                  onChange={(e) => setConfig({
                    ...config,
                    messageTemplates: { ...config.messageTemplates, subjectTo: e.target.value }
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
