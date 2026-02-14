'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Home, DollarSign, TrendingUp, MapPin } from 'lucide-react';

interface Property {
  address: string;
  city: string;
  state: string;
  zip: string;
  currentValue: number;
  arv: number;
  cashOffer: number;
  wholesalePrice: number;
  arvSpread: number;
  ltv: number;
  strategy: string;
  financing: string;
  contextNotes: string;
  outreachMessage: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties() {
    setLoading(true);
    try {
      const response = await fetch('/api/evaluate');
      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        // Load the most recent evaluated file
        // In production, this would be more sophisticated
        console.log('Available files:', data.files);
      }
    } catch (error) {
      console.error('Failed to load properties:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading properties...</p>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div>
        <h1 className="text-4xl font-bold mb-2">Properties</h1>
        <p className="text-muted-foreground mb-8">
          View and manage evaluated properties
        </p>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No properties yet</h3>
              <p className="text-muted-foreground mb-6">
                Export and evaluate properties from the dashboard to see them here
              </p>
              <Button onClick={() => window.location.href = '/'}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-2">Properties</h1>
      <p className="text-muted-foreground mb-8">
        {properties.length} evaluated properties
      </p>

      <div className="grid gap-4">
        {properties.map((property, index) => (
          <Card key={index} className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setSelectedProperty(property)}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {property.address}
                  </CardTitle>
                  <CardDescription>
                    {property.city}, {property.state} {property.zip}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{formatCurrency(property.cashOffer)}</div>
                  <div className="text-sm text-muted-foreground">Cash Offer</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Value</p>
                  <p className="font-semibold">{formatCurrency(property.currentValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ARV</p>
                  <p className="font-semibold">{formatCurrency(property.arv)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ARV Spread</p>
                  <p className="font-semibold text-green-600">{property.arvSpread.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">LTV</p>
                  <p className="font-semibold">{property.ltv.toFixed(1)}%</p>
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  {property.strategy}
                </span>
                <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-medium">
                  {property.financing}
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                {property.bedrooms} bed • {property.bathrooms} bath • {property.sqft.toLocaleString()} sqft
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedProperty(null)}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>{selectedProperty.address}</CardTitle>
              <CardDescription>
                {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Financial Analysis</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Value</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedProperty.currentValue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ARV</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedProperty.arv)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cash Offer</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(selectedProperty.cashOffer)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wholesale Price</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedProperty.wholesalePrice)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Strategy</h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                    {selectedProperty.strategy}
                  </span>
                  <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-medium">
                    {selectedProperty.financing}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Context Notes</h3>
                <p className="text-sm text-muted-foreground">{selectedProperty.contextNotes}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Outreach Message</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedProperty.outreachMessage}</p>
                </div>
              </div>

              <Button onClick={() => setSelectedProperty(null)} className="w-full">
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
