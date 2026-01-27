/**
 * Settings Modal Component
 * Handles UI for application configuration
 */
window.SettingsModal = () => {
    return {
        show: false,
        activeTab: 's3',
        loading: false,
        saving: false,
        testing: false,
        config: null,
        hasFileConfig: false,
        testResult: null,

        async init() {
            // Ensure modal is closed initially
            this.show = false;
            console.log('SettingsModal: init() called, show is now:', this.show);
            
            // Listen for open-settings event
            window.addEventListener('open-settings', () => {
                console.log('SettingsModal: Received open-settings event');
                this.open();
            });
            console.log('SettingsModal: Event listener registered');
        },

        async open() {
            console.log('SettingsModal: open() called');
            this.show = true;
            await this.loadConfig();
        },

        close() {
            console.log('SettingsModal: close() called');
            this.show = false;
            this.testResult = null;
        },

        async loadConfig() {
            this.loading = true;
            this.testResult = null;
            try {
                const response = await window.ConfigAPI.get();
                if (response.success) {
                    this.config = response.data;
                    this.hasFileConfig = response.data.hasFileConfig;
                    
                    // Convert bucketNames array to comma-separated string for editing
                    if (this.config.s3 && Array.isArray(this.config.s3.bucketNames)) {
                        this.config.s3.bucketNamesString = this.config.s3.bucketNames.join(', ');
                    }

                    // Masked passwords/secrets should be cleared if the user wants to update them
                    // but we keep the placeholders from server for display
                } else {
                    window.Notifications.show('Failed to load configuration', 'error');
                }
            } catch (error) {
                console.error('Error loading config:', error);
                window.Notifications.show('Error loading configuration', 'error');
            } finally {
                this.loading = false;
            }
        },

        async saveConfig() {
            this.saving = true;
            this.testResult = null;
            try {
                // Prepare config for saving
                const configToSave = JSON.parse(JSON.stringify(this.config));
                
                // Convert bucketNamesString back to array
                if (configToSave.s3.bucketNamesString) {
                    configToSave.s3.bucketNames = configToSave.s3.bucketNamesString
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);
                    delete configToSave.s3.bucketNamesString;
                }

                // Handle masked values: If they are still the masked placeholders, don't send them 
                // or handle appropriately on backend. For simplicity, we assume the user 
                // either leaves them as is (backend should ignore if they match pattern)
                // or enters new values.

                const response = await window.ConfigAPI.update(configToSave);
                if (response.success) {
                    window.Notifications.show('Configuration saved successfully. Server restart may be required for some changes.', 'success');
                    this.hasFileConfig = true;
                    // Reload to get new masked values
                    await this.loadConfig();
                } else {
                    window.Notifications.show(response.error?.message || 'Failed to save configuration', 'error');
                }
            } catch (error) {
                console.error('Error saving config:', error);
                window.Notifications.show('Error saving configuration', 'error');
            } finally {
                this.saving = false;
            }
        },

        async resetConfig() {
            if (!confirm('Are you sure you want to reset to environment defaults? This will delete the UI configuration file.')) {
                return;
            }

            this.saving = true;
            try {
                const response = await window.ConfigAPI.reset();
                if (response.success) {
                    window.Notifications.show('Configuration reset to defaults', 'success');
                    await this.loadConfig();
                } else {
                    window.Notifications.show('Failed to reset configuration', 'error');
                }
            } catch (error) {
                console.error('Error resetting config:', error);
                window.Notifications.show('Error resetting configuration', 'error');
            } finally {
                this.saving = false;
            }
        },

        async testS3() {
            this.testing = true;
            this.testResult = null;
            try {
                const configToTest = {
                    endpoint: this.config.s3.endpoint,
                    accessKeyId: this.config.s3.accessKeyId,
                    secretAccessKey: this.config.s3.secretAccessKey,
                    bucketNames: this.config.s3.bucketNamesString.split(',').map(s => s.trim()).filter(Boolean),
                    region: this.config.s3.region
                };

                const response = await window.ConfigAPI.test('s3', configToTest);
                this.testResult = {
                    success: response.success,
                    message: response.data?.message || response.message,
                    details: response.data?.details
                };
            } catch (error) {
                this.testResult = {
                    success: false,
                    message: 'Test failed: ' + error.message
                };
            } finally {
                this.testing = false;
            }
        },

        async testOIDC() {
            this.testing = true;
            this.testResult = null;
            try {
                const response = await window.ConfigAPI.test('oidc', this.config.auth.oidc);
                this.testResult = {
                    success: response.success,
                    message: response.data?.message || response.message,
                    details: response.data?.details
                };
            } catch (error) {
                this.testResult = {
                    success: false,
                    message: 'Test failed: ' + error.message
                };
            } finally {
                this.testing = false;
            }
        }
    };
};
