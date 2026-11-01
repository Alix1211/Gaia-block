package com.gaiacity.heartbreaker;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.ClipData;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.DocumentsContract;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Offline HTML game, native Android vibration and persistent SAF folder picker.
 * No INTERNET permission: every game resource is intercepted and served from
 * app assets through the fixed same-origin virtual HTTPS host.
 */
public final class MainActivity extends Activity {
    private static final String HOST = "gaia.local";
    private static final String BASE = "https://" + HOST + "/";
    private static final int REQUEST_FOLDER = 101;
    private static final int REQUEST_IMAGE_FILES = 102;
    private static final String PREFS = "gaia_android_native";
    private static final String SAVED_FOLDER = "background_tree";
    private static final int MAX_IMAGES = 450;

    private WebView webView;
    private ValueCallback<Uri[]> browserFileCallback;
    private final Map<String, Uri> selectedImages = new ConcurrentHashMap<>();
    private boolean immersive = true;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                             WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        applyImmersiveMode(true);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(44, 21, 50));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        setContentView(webView, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setDefaultTextEncodingName("UTF-8");
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        webView.addJavascriptInterface(new VibrationBridge(), "GaiaNativeVibration");
        webView.addJavascriptInterface(new FolderBridge(), "GaiaNativeFiles");
        webView.addJavascriptInterface(new UiBridge(), "GaiaNativeUI");
        webView.setWebViewClient(new LocalGameWebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (browserFileCallback != null) browserFileCallback.onReceiveValue(null);
                browserFileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.setType("image/*");
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(pick, REQUEST_IMAGE_FILES);
                } catch (Exception error) {
                    browserFileCallback.onReceiveValue(null);
                    browserFileCallback = null;
                }
                return true;
            }
        });
        webView.loadUrl(BASE + "index.html");
    }

    @Override public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Let the existing separate landscape/portrait CSS switch without
        // destroying the WebView and the in-progress stage.
    }

    @Override protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("GaiaNativeVibration");
            webView.removeJavascriptInterface("GaiaNativeFiles");
            webView.removeJavascriptInterface("GaiaNativeUI");
            webView.destroy();
        }
        super.onDestroy();
    }

    private void applyImmersiveMode(boolean enable) {
        immersive = enable;
        View decor = getWindow().getDecorView();
        int flags = enable ? (
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE) : View.SYSTEM_UI_FLAG_VISIBLE;
        decor.setSystemUiVisibility(flags);
    }

    private final class UiBridge {
        @JavascriptInterface public void toggleFullscreen() {
            runOnUiThread(() -> {
                applyImmersiveMode(!immersive);
                if (webView != null) {
                    webView.evaluateJavascript(
                        "document.getElementById('fullscreenButton').textContent=" +
                        (immersive ? "'⤡'" : "'⛶'") + ";", null);
                }
            });
        }
    }

    private final class VibrationBridge {
        @JavascriptInterface public boolean vibrate(String patternJson) {
            try {
                JSONArray requested = new JSONArray(patternJson);
                if (requested.length() == 0 || requested.length() > 17) return false;
                Vibrator motor;
                if (Build.VERSION.SDK_INT >= 31) {
                    VibratorManager manager = (VibratorManager)
                        getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    motor = manager == null ? null : manager.getDefaultVibrator();
                } else {
                    motor = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                }
                if (motor == null || !motor.hasVibrator()) return false;

                // Navigator.vibrate pattern: on, off, on... Strong amplitude
                // for tablets with weak vibration hardware. Initial delay 0.
                long[] timings = new long[requested.length() + 1];
                int[] strengths = new int[requested.length() + 1];
                timings[0] = 0L;
                strengths[0] = 0;
                long totalMs = 0;
                for (int i = 0; i < requested.length(); i++) {
                    long duration = Math.max(1, Math.min(250, requested.optLong(i, 20)));
                    totalMs += duration;
                    if (totalMs > 1200L) return false;
                    timings[i + 1] = duration;
                    strengths[i + 1] = (i % 2 == 0) ? 255 : 0;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    motor.vibrate(VibrationEffect.createWaveform(timings, strengths, -1));
                } else {
                    motor.vibrate(timings, -1);
                }
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }
    }

    private final class FolderBridge {
        @JavascriptInterface public void selectFolder() {
            runOnUiThread(() -> {
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                              Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                try { startActivityForResult(pick, REQUEST_FOLDER); }
                catch (Exception ignored) { /* Android file manager unavailable */ }
            });
        }
        @JavascriptInterface public void clearFolder() {
            getPreferences().edit().remove(SAVED_FOLDER).apply();
            selectedImages.clear();
        }
    }

    private SharedPreferences getPreferences() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override protected void onActivityResult(int code, int result, Intent intent) {
        super.onActivityResult(code, result, intent);
        if (code == REQUEST_IMAGE_FILES) {
            ValueCallback<Uri[]> callback = browserFileCallback;
            browserFileCallback = null;
            if (callback == null) return;
            if (result != RESULT_OK || intent == null) {
                callback.onReceiveValue(null);
                return;
            }
            List<Uri> output = new ArrayList<>();
            if (intent.getClipData() != null) {
                ClipData clip = intent.getClipData();
                for (int i = 0; i < clip.getItemCount(); i++)
                    output.add(clip.getItemAt(i).getUri());
            } else if (intent.getData() != null) {
                output.add(intent.getData());
            }
            callback.onReceiveValue(output.toArray(new Uri[0]));
            return;
        }
        if (code == REQUEST_FOLDER && result == RESULT_OK && intent != null) {
            Uri folder = intent.getData();
            if (folder == null) return;
            try {
                getContentResolver().takePersistableUriPermission(
                    folder, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getPreferences().edit().putString(SAVED_FOLDER, folder.toString()).apply();
                scanFolder(folder);
            } catch (SecurityException ignored) {
                // The chosen provider did not grant durable access.
            }
        }
    }

    private void restoreFolder() {
        String value = getPreferences().getString(SAVED_FOLDER, null);
        if (value == null || value.isEmpty()) return;
        try { scanFolder(Uri.parse(value)); } catch (Exception ignored) { /* inaccessible */ }
    }

    private void scanFolder(Uri folder) {
        new Thread(() -> {
            final List<Uri> uris = new ArrayList<>();
            try {
                String rootId = DocumentsContract.getTreeDocumentId(folder);
                collectImages(folder, rootId, uris, 0);
            } catch (Exception ignored) {
                // Folder may have been removed or permission revoked.
            }
            selectedImages.clear();
            JSONArray list = new JSONArray();
            for (int i = 0; i < uris.size(); i++) {
                String id = "image" + i;
                selectedImages.put(id, uris.get(i));
                list.put(BASE + "bg/" + id);
            }
            runOnUiThread(() -> {
                if (webView != null)
                    webView.evaluateJavascript(
                        "window.GaiaNativeFolder && window.GaiaNativeFolder.onFiles(" +
                        list.toString() + ");", null);
            });
        }, "gaia-folder-images").start();
    }

    private void collectImages(Uri tree, String docId, List<Uri> images, int depth) {
        if (depth > 8 || images.size() >= MAX_IMAGES) return;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        String[] fields = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME
        };
        try (Cursor cursor = getContentResolver().query(children, fields, null, null, null)) {
            if (cursor == null) return;
            while (cursor.moveToNext() && images.size() < MAX_IMAGES) {
                String id = cursor.getString(0);
                String mime = cursor.getString(1);
                String name = cursor.getString(2);
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    collectImages(tree, id, images, depth + 1);
                } else if ((mime != null && mime.startsWith("image/")) ||
                           (name != null && name.matches("(?i).*\\.(png|jpg|jpeg|webp|gif|bmp|avif)$"))) {
                    images.add(DocumentsContract.buildDocumentUriUsingTree(tree, id));
                }
            }
        } catch (Exception ignored) { /* inaccessible child or revoked grant */ }
    }

    private static String mimeType(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".avif")) return "image/avif";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        return "application/octet-stream";
    }

    private final class LocalGameWebViewClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri target = request.getUrl();
            return !("https".equals(target.getScheme()) && HOST.equals(target.getHost()));
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost()))
                return blocked();
            String path = uri.getPath();
            if (path == null || path.contains("..")) return blocked();
            try {
                if (path.startsWith("/bg/")) {
                    Uri imageUri = selectedImages.get(path.substring(4));
                    if (imageUri == null) return blocked();
                    String mime = getContentResolver().getType(imageUri);
                    InputStream stream = getContentResolver().openInputStream(imageUri);
                    if (stream == null) return blocked();
                    return new WebResourceResponse(
                        mime != null && mime.startsWith("image/") ? mime : "image/jpeg",
                        null, stream);
                }
                if (!path.matches("/[a-zA-Z0-9_./-]+")) return blocked();
                String name = path.equals("/") ? "index.html" : path.substring(1);
                InputStream stream = getAssets().open("www/" + name);
                WebResourceResponse response = new WebResourceResponse(
                    mimeType(name), name.endsWith(".html") || name.endsWith(".js") ||
                    name.endsWith(".css") ? "UTF-8" : null, stream);
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-store");
                response.setResponseHeaders(headers);
                return response;
            } catch (Exception ignored) {
                return blocked();
            }
        }
        @Override public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if ((BASE + "index.html").equals(url)) restoreFolder();
        }
        private WebResourceResponse blocked() {
            return new WebResourceResponse("text/plain", "UTF-8", 404,
                "Not Found", new HashMap<String,String>(),
                new ByteArrayInputStream(new byte[0]));
        }
    }
}
