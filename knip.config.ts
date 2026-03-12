export default {
    project: ['src/**/*.ts', 'e2e/**/*.ts'],
    ignore: [
        'e2e/**/*',
    ],
    ignoreDependencies: ['@vitest/coverage-v8'],
    ignoreExportsUsedInFile: true,
};
