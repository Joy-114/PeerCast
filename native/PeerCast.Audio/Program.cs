using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
namespace PeerCast.Audio;
record AudioApplication(uint pid,string identity,string name,string processName,bool active,float peak);
static class Program {
 [MTAThread] static int Main(string[] args) {
  try {
   if(args.Length==1&&args[0]=="--list"){Console.WriteLine(JsonSerializer.Serialize(List()));return 0;}
   if(args.Length==1&&args[0]=="--capabilities"){Console.WriteLine(JsonSerializer.Serialize(new{supported=OperatingSystem.IsWindowsVersionAtLeast(10,0,20348),api="WASAPI Process Loopback",sampleRate=48000,channels=2,bits=16}));return 0;}
   if(args.Length==3&&args[0]=="--capture"&&uint.TryParse(args[1],out uint pid)){Capture(pid,args[2]);return 0;}
   Console.Error.WriteLine("Usage: --list | --capabilities | --capture PID START_TICKS");return 2;
  }catch(Exception e){Console.Error.WriteLine(JsonSerializer.Serialize(new{status="error",message=e.Message,stack=e.StackTrace,hresult=$"0x{e.HResult:X8}"}));return 1;}
 }
 static List<AudioApplication> List() {
  var found=new Dictionary<uint,AudioApplication>(); var devices=(IMMDeviceEnumerator)new DeviceEnumerator(); IMMDeviceCollection? collection=null;
  try {
   devices.EnumAudioEndpoints(0,1,out collection);collection.GetCount(out uint count);
   for(uint d=0;d<count;d++) {
    IMMDevice? device=null;object? managerObject=null;IAudioSessionEnumerator? sessions=null;
    try {
     collection.Item(d,out device);var iid=typeof(IAudioSessionManager2).GUID;device.Activate(ref iid,23,IntPtr.Zero,out managerObject);var manager=(IAudioSessionManager2)managerObject;
     manager.GetSessionEnumerator(out sessions);sessions.GetCount(out int length);
     for(int i=0;i<length;i++) {
      IAudioSessionControl2? control=null;
      try {
       sessions.GetSession(i,out control);control.GetProcessId(out uint pid);control.GetState(out int state);if(pid==0||state==2)continue;
       using var process=Process.GetProcessById((int)pid);float peak=0;try{((IAudioMeterInformation)control).GetPeakValue(out peak);}catch(COMException){}
       var entry=new AudioApplication(pid,process.StartTime.ToUniversalTime().Ticks.ToString(),string.IsNullOrWhiteSpace(process.MainWindowTitle)?process.ProcessName:process.MainWindowTitle,process.ProcessName+".exe",state==1,peak);
       if(!found.TryGetValue(pid,out var old)||entry.peak>old.peak)found[pid]=entry;
      }catch(Exception e)when(e is COMException||e is ArgumentException||e is System.ComponentModel.Win32Exception||e is InvalidOperationException){}finally{Native.Release(control);}
     }
    }catch(COMException){}finally{Native.Release(sessions);Native.Release(managerObject);Native.Release(device);}
   }
  }finally{Native.Release(collection);Native.Release(devices);}
  return found.Values.ToList();
 }
 static void Capture(uint pid,string identity) {
  if(!OperatingSystem.IsWindowsVersionAtLeast(10,0,20348))throw new PlatformNotSupportedException("Application Audio requires Windows build 20348 or newer (Windows 11 recommended).");
  using var target=Process.GetProcessById(checked((int)pid));if(target.StartTime.ToUniversalTime().Ticks.ToString()!=identity)throw new InvalidOperationException("Application restarted; refresh applications and select again.");
  if(!List().Any(app=>app.pid==pid&&app.identity==identity))throw new InvalidOperationException("Application audio session unavailable.");
  var parameters=new ProcessParams{type=1,pid=pid,mode=0};var memory=Marshal.AllocHGlobal(Marshal.SizeOf<ProcessParams>());
  IActivateAudioInterfaceAsyncOperation? operation=null;IAudioClient? client=null;IAudioCaptureClient? capture=null;var callback=new Activation();
  using var sampleReady=new EventWaitHandle(false,EventResetMode.AutoReset);using var stop=new CancellationTokenSource();
  var inputTask=Task.Run(()=>{Console.ReadLine();stop.Cancel();});
  bool started=false;
  try {
   Marshal.StructureToPtr(parameters,memory,false);var variant=new PropVariant{vt=65,size=(uint)Marshal.SizeOf<ProcessParams>(),data=memory};var iid=typeof(IAudioClient).GUID;
   Marshal.ThrowExceptionForHR(Native.ActivateAudioInterfaceAsync("VAD\\Process_Loopback",ref iid,ref variant,callback,out operation));
   if(!callback.Ready.Wait(TimeSpan.FromSeconds(10)))throw new TimeoutException("Audio activation timeout");
   if(callback.Error!=null)throw callback.Error;client=callback.Client!;
   var format=new WaveFormat{tag=1,channels=2,rate=48000,bytes=192000,align=4,bits=16,extra=0};
   client.Initialize(0,0x00020000|0x00040000|0x80000000,0,0,ref format,IntPtr.Zero);
   var captureId=typeof(IAudioCaptureClient).GUID;client.GetService(ref captureId,out object service);capture=(IAudioCaptureClient)service;
   client.SetEventHandle(sampleReady.SafeWaitHandle.DangerousGetHandle());client.Start();started=true;
   Console.Error.WriteLine(JsonSerializer.Serialize(new{status="ready",pid,sampleRate=48000,channels=2,bits=16}));
   using var output=Console.OpenStandardOutput();
   while(!stop.IsCancellationRequested&&!target.HasExited) {
    sampleReady.WaitOne(100);capture.GetNextPacketSize(out uint packet);
    while(packet>0&&!stop.IsCancellationRequested) {
     capture.GetBuffer(out IntPtr data,out uint frames,out uint flags,out _,out _);
     try {var pcm=new byte[checked((int)frames*4)];if((flags&2)==0)Marshal.Copy(data,pcm,0,pcm.Length);output.Write(pcm);output.Flush();}finally{capture.ReleaseBuffer(frames);}
     capture.GetNextPacketSize(out packet);
    }
   }
   Console.Error.WriteLine(JsonSerializer.Serialize(new{status="stopped",message=target.HasExited?"Application closed":"Capture stopped"}));
  }finally{
   if(started)try{client?.Stop();}catch(COMException){}
   Native.Release(capture);Native.Release(client);Native.Release(operation);Marshal.FreeHGlobal(memory);
  }
 }
}
