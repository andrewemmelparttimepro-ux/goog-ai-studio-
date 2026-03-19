/**
 * External Data Service for SP OMP
 * Handles integration with external systems like KPH EHS and SAP.
 */

export interface ExternalDataPoint {
  value: number;
  timestamp: Date;
  source: string;
}

export const fetchExternalMetric = async (
  source: 'KPH_EHS' | 'SAP',
  integrationId: string
): Promise<ExternalDataPoint> => {
  console.log(`Fetching data from ${source} for ID: ${integrationId}...`);
  
  // In a real implementation, this would be:
  // const apiKey = process.env.VITE_KPH_EHS_API_KEY;
  // const response = await fetch(`https://api.kphehs.com/v1/metrics/${integrationId}`, {
  //   headers: { 'Authorization': `Bearer ${apiKey}` }
  // });
  // return await response.json();

  // For the demo, we simulate a real API call with a slight delay and randomized realistic data
  await new Promise(resolve => setTimeout(resolve, 800));

  // Simulate data based on source
  let value = 0;
  if (source === 'KPH_EHS') {
    // Simulate safety/environmental data
    value = Math.floor(Math.random() * 50) + 10; 
  } else if (source === 'SAP') {
    // Simulate production/financial data
    value = Math.floor(Math.random() * 1000) + 500;
  }

  return {
    value,
    timestamp: new Date(),
    source
  };
};

/**
 * Validates an integration ID against the external system.
 */
export const validateIntegration = async (
  source: 'KPH_EHS' | 'SAP',
  integrationId: string
): Promise<boolean> => {
  // Simulate validation check
  await new Promise(resolve => setTimeout(resolve, 500));
  return integrationId.length > 3; // Simple validation for demo
};
