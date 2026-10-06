plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Signing comes from JL_KEYSTORE_* (set by .github/workflows/jl-release.yml). Without them the
// build falls back to the debug key, which can't update an install signed with the release key.
val keystoreFile = System.getenv("JL_KEYSTORE_FILE")
val runNumber = System.getenv("GITHUB_RUN_NUMBER") ?: "1"

android {
    namespace = "com.jlstream.mediavision"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.jlstream.mediavision"
        minSdk = 24
        targetSdk = 35
        versionCode = runNumber.toInt()
        versionName = "1.0.$runNumber"
        // The web app this shell opens. Change it here when the app moves to watch.jl-stream.com.
        buildConfigField("String", "APP_URL", "\"https://jl-media-vision.vercel.app/\"")
    }

    signingConfigs {
        if (keystoreFile != null) {
            create("release") {
                storeFile = file(keystoreFile)
                storePassword = System.getenv("JL_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("JL_KEY_ALIAS")
                keyPassword = System.getenv("JL_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keystoreFile != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
}
