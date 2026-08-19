export default {
    project: ['src/**/*.ts', 'e2e/**/*.ts'],
    ignore: [
        'e2e/**/*',
    ],
    ignoreDependencies: ['@vitest/coverage-v8'],
    // Globally linked fleet tool (github.com/Observeone1/oo-sonar), never a dependency.
    ignoreBinaries: ['oo-sonar'],
    ignoreExportsUsedInFile: true,
};
