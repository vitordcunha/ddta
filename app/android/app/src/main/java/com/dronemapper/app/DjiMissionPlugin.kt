package com.dronemapper.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.util.UUID

/**
 * Lista e grava KMZs nas pastas de waypoint do DJI Fly e DJI Pilot 2.
 * Em Android 11+ é necessário [Environment.isExternalStorageManager] para ler/escrever
 * em `Android/data/...` de outras apps.
 */
@CapacitorPlugin(name = "DjiMission")
class DjiMissionPlugin : Plugin() {

  private fun externalRoot(): File = Environment.getExternalStorageDirectory()

  private fun waypointDir(packageName: String): File =
    File(externalRoot(), "Android/data/$packageName/files/waypoint")

  private fun hasFullStorageAccess(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Environment.isExternalStorageManager()
    } else {
      @Suppress("DEPRECATION")
      true
    }
  }

  @PluginMethod
  fun checkAllFilesAccess(call: PluginCall) {
    val ret = JSObject()
    ret.put("granted", hasFullStorageAccess())
    call.resolve(ret)
  }

  @PluginMethod
  fun requestAllFilesAccess(call: PluginCall) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
      try {
        val intent =
          Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
            data = Uri.parse("package:${activity.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        activity.startActivity(intent)
      } catch (_: Exception) {
        val fallback = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(fallback)
      }
    }
    val ret = JSObject()
    ret.put("granted", hasFullStorageAccess())
    call.resolve(ret)
  }

  @PluginMethod
  fun listMissions(call: PluginCall) {
    val missions = JSArray()
    if (!hasFullStorageAccess()) {
      val ret = JSObject()
      ret.put("missions", missions)
      ret.put("storageAccess", false)
      call.resolve(ret)
      return
    }
    appendKmzFromDir(waypointDir(DJI_FLY_PKG), APP_KEY_FLY, missions)
    appendKmzFromDir(waypointDir(DJI_PILOT2_PKG), APP_KEY_PILOT2, missions)
    val ret = JSObject()
    ret.put("missions", missions)
    ret.put("storageAccess", true)
    call.resolve(ret)
  }

  private fun appendKmzFromDir(dir: File, appKey: String, out: JSArray) {
    if (!dir.isDirectory) return
    dir
      .listFiles()
      ?.filter { it.isFile && it.name.endsWith(KMZ_EXT, ignoreCase = true) }
      ?.sortedByDescending { it.lastModified() }
      ?.forEach { f ->
        val o = JSObject()
        o.put("name", f.name)
        o.put("path", f.absolutePath)
        o.put("app", appKey)
        o.put("modifiedMs", f.lastModified())
        out.put(o)
      }
  }

  @PluginMethod
  fun replaceMission(call: PluginCall) {
    val b64 = call.getString("kmzBase64")
    if (b64.isNullOrBlank()) {
      call.reject("missing_kmz", "kmzBase64 is required", null as Exception?)
      return
    }
    if (!hasFullStorageAccess()) {
      call.reject("no_storage_access", "Grant all files access in system settings", null as Exception?)
      return
    }
    val appKey = call.getString("app") ?: APP_KEY_FLY
    val pkg =
      when (appKey.lowercase()) {
        APP_KEY_PILOT2, "pilot" -> DJI_PILOT2_PKG
        else -> DJI_FLY_PKG
      }
    val dir = waypointDir(pkg)
    if (!dir.exists() && !dir.mkdirs()) {
      call.reject("mkdir_failed", "Could not create waypoint directory", null as Exception?)
      return
    }
    val bytes =
      try {
        Base64.decode(b64, Base64.DEFAULT)
      } catch (_: Exception) {
        call.reject("invalid_base64", "Could not decode KMZ", null as Exception?)
        return
      }
    val uuid = call.getString("uuid")?.trim().orEmpty()
    val fileName =
      when {
        uuid.isEmpty() -> "${UUID.randomUUID()}$KMZ_EXT"
        uuid.endsWith(KMZ_EXT, ignoreCase = true) -> uuid
        else -> "$uuid$KMZ_EXT"
      }
    val out = File(dir, fileName)
    try {
      out.writeBytes(bytes)
      val ret = JSObject()
      ret.put("ok", true)
      ret.put("path", out.absolutePath)
      call.resolve(ret)
    } catch (e: Exception) {
      call.reject("write_failed", e.message, e)
    }
  }

  companion object {
    private const val KMZ_EXT = ".kmz"
    private const val DJI_FLY_PKG = "dji.go.v5"
    private const val DJI_PILOT2_PKG = "dji.pilot2"
    private const val APP_KEY_FLY = "fly"
    private const val APP_KEY_PILOT2 = "pilot2"
  }
}
