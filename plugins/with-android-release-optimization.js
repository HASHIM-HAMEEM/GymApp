const { AndroidConfig, withGradleProperties } = require('@expo/config-plugins');

module.exports = function withAndroidReleaseOptimization(config) {
  return withGradleProperties(config, (nextConfig) => {
    nextConfig.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      nextConfig.modResults,
      'android.enableMinifyInReleaseBuilds',
      'true',
    );
    nextConfig.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      nextConfig.modResults,
      'android.enableShrinkResourcesInReleaseBuilds',
      'true',
    );
    return nextConfig;
  });
};
