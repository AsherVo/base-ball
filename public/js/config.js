// Config loader - fetches constants and entity definitions from server
let configLoaded = false;
let configPromise = null;

async function loadConfig() {
    if (configLoaded) return;
    if (configPromise) return configPromise;

    configPromise = fetch('/api/config')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load config');
            return response.json();
        })
        .then(config => {
            window.CONSTANTS = config.constants;
            window.EntityDefs = config.entityDefs;
            window.getEntityDef = function(category, subtype) {
                const categoryDefs = EntityDefs[category];
                if (!categoryDefs) return null;
                return categoryDefs[subtype] || null;
            };
            configLoaded = true;
            console.log('Config loaded:', window.CONSTANTS);
        })
        .catch(err => {
            console.error('Failed to load config:', err);
        });

    return configPromise;
}

// Auto-load on script load
window.configReady = loadConfig();
