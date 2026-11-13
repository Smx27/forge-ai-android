# React Native, Hermes, SoLoader and the autolinked libraries ship their own consumer rules.
# These rules only cover Forge's own native code.

# Native modules: React Native finds @ReactMethod members by reflection.
-keepclassmembers class com.forge.** {
    @com.facebook.react.bridge.ReactMethod *;
}

# Classes created by Android from the manifest are kept by AAPT; their names can still be obfuscated otherwise.
-keep class com.forge.MainApplication
-keep class com.forge.MainActivity

# llama.rn loads its JNI bridge by class and method name.
-keep class com.rnllama.** { *; }

# MMKV and its JNI callbacks.
-keep class com.tencent.mmkv.** { *; }
-keep class com.mrousavy.mmkv.** { *; }

# react-native-svg and webview use reflection for some view managers.
-keep class com.horcrux.svg.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }

# Strip verbose and debug logging from release builds.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

-dontwarn com.facebook.react.**
-dontwarn org.slf4j.**
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
