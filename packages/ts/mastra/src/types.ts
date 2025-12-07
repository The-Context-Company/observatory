export type TCCMastraExporterConfig = {
  /**
   * TCC API key. Can also be set via TCC_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * TCC endpoint URL. Defaults to https://api.thecontext.company/v1/traces
   */
  endpoint?: string;

  /**
   * Enable debug logging
   */
  debug?: boolean;
};
