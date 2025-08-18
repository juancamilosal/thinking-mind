import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    // Server-specific providers can be added here
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
