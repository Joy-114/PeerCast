!include nsDialogs.nsh
!include LogicLib.nsh
!ifndef BUILD_UNINSTALLER
Var PeerCastDesktopShortcut
Var PeerCastMenuShortcut
Var PeerCastDesktopCheck
Var PeerCastMenuCheck
!macro customPageAfterChangeDir
 Page custom PeerCastShortcutPage PeerCastShortcutLeave
!macroend
Function PeerCastShortcutPage
 nsDialogs::Create 1018
 Pop $0
 ${NSD_CreateLabel} 0 0 100% 24u "Choose PeerCast shortcuts"
 Pop $0
 ${NSD_CreateCheckbox} 0 32u 100% 12u "Create Desktop Shortcut"
 Pop $PeerCastDesktopCheck
 ${NSD_Check} $PeerCastDesktopCheck
 ${NSD_CreateCheckbox} 0 56u 100% 12u "Create Start Menu Shortcut"
 Pop $PeerCastMenuCheck
 ${NSD_Check} $PeerCastMenuCheck
 nsDialogs::Show
FunctionEnd
Function PeerCastShortcutLeave
 ${NSD_GetState} $PeerCastDesktopCheck $PeerCastDesktopShortcut
 ${NSD_GetState} $PeerCastMenuCheck $PeerCastMenuShortcut
FunctionEnd
!macro customInstall
 WriteINIStr "$INSTDIR\install-options.ini" "Shortcuts" "Desktop" "$PeerCastDesktopShortcut"
 WriteINIStr "$INSTDIR\install-options.ini" "Shortcuts" "StartMenu" "$PeerCastMenuShortcut"
 ${If} $PeerCastDesktopShortcut == ${BST_CHECKED}
  CreateShortCut "$DESKTOP\PeerCast.lnk" "$INSTDIR\PeerCast.exe"
 ${EndIf}
 ${If} $PeerCastMenuShortcut == ${BST_CHECKED}
  CreateDirectory "$SMPROGRAMS\PeerCast"
  CreateShortCut "$SMPROGRAMS\PeerCast\PeerCast.lnk" "$INSTDIR\PeerCast.exe"
 ${EndIf}
!macroend
!endif
!macro customUnInstall
 Delete "$DESKTOP\PeerCast.lnk"
 Delete "$SMPROGRAMS\PeerCast\PeerCast.lnk"
 RMDir "$SMPROGRAMS\PeerCast"
 DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PeerCast"
!macroend
