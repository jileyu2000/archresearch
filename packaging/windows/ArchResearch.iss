#ifndef AppVersion
  #error AppVersion must be provided by build-windows-installer.ps1
#endif
#ifndef SourceDir
  #error SourceDir must be provided by build-windows-installer.ps1
#endif
#ifndef OutputDir
  #error OutputDir must be provided by build-windows-installer.ps1
#endif
#ifndef IconFile
  #error IconFile must be provided by build-windows-installer.ps1
#endif

[Setup]
AppId={{5D74473F-201D-4AF0-95AE-B06F92866E2E}
AppName=ArchResearch
AppVersion={#AppVersion}
AppPublisher=ArchResearch
AppPublisherURL=https://github.com/jileyu2000/archresearch-chrome-extension
AppSupportURL=https://github.com/jileyu2000/archresearch-chrome-extension/issues
DefaultDirName={localappdata}\Programs\ArchResearch
DefaultGroupName=ArchResearch
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=ArchResearch-Windows-x64-Setup-v{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
UninstallDisplayIcon={app}\ArchResearch.exe
SetupIconFile={#IconFile}
VersionInfoVersion={#AppVersion}
VersionInfoDescription=ArchResearch Windows Installer
VersionInfoProductName=ArchResearch
VersionInfoProductVersion={#AppVersion}

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\ArchResearch"; Filename: "{app}\ArchResearch.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\ArchResearch"; Filename: "{app}\ArchResearch.exe"; WorkingDir: "{app}"

[Run]
Filename: "{app}\ArchResearch.exe"; Description: "打开 ArchResearch"; Flags: nowait postinstall skipifsilent
