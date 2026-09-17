using System.Runtime.InteropServices;
namespace PeerCast.Audio;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class DeviceEnumerator {}
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IMMDeviceEnumerator {
 void EnumAudioEndpoints(int flow,uint mask,out IMMDeviceCollection devices);
 void GetDefaultAudioEndpoint(int flow,int role,out IMMDevice device);
}
[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IMMDeviceCollection {void GetCount(out uint count);void Item(uint index,out IMMDevice device);}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IMMDevice {
 void Activate(ref Guid iid,uint context,IntPtr parameters,[MarshalAs(UnmanagedType.IUnknown)]out object result);
 void OpenPropertyStore(uint mode,out IntPtr store);void GetId([MarshalAs(UnmanagedType.LPWStr)]out string id);void GetState(out uint state);
}
[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IAudioSessionManager2 {
 void GetAudioSessionControl(IntPtr guid,uint flags,out IntPtr control);void GetSimpleAudioVolume(IntPtr guid,uint flags,out IntPtr volume);void GetSessionEnumerator(out IAudioSessionEnumerator enumerator);
}
[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IAudioSessionEnumerator {void GetCount(out int count);void GetSession(int index,out IAudioSessionControl2 control);}
[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IAudioSessionControl2 {
 void GetState(out int state);void GetDisplayName([MarshalAs(UnmanagedType.LPWStr)]out string name);void SetDisplayName([MarshalAs(UnmanagedType.LPWStr)]string name,IntPtr context);
 void GetIconPath([MarshalAs(UnmanagedType.LPWStr)]out string path);void SetIconPath([MarshalAs(UnmanagedType.LPWStr)]string path,IntPtr context);
 void GetGroupingParam(out Guid value);void SetGroupingParam(ref Guid value,IntPtr context);void RegisterAudioSessionNotification(IntPtr events);void UnregisterAudioSessionNotification(IntPtr events);
 void GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)]out string id);void GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)]out string id);void GetProcessId(out uint id);
 [PreserveSig]int IsSystemSoundsSession();void SetDuckingPreference([MarshalAs(UnmanagedType.Bool)]bool optOut);
}
[ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IAudioMeterInformation {void GetPeakValue(out float peak);}
[StructLayout(LayoutKind.Sequential,Pack=2)] public struct WaveFormat {public ushort tag,channels;public uint rate,bytes;public ushort align,bits,extra;}
[StructLayout(LayoutKind.Sequential)] struct ProcessParams {public int type;public uint pid;public int mode;}
[StructLayout(LayoutKind.Explicit,Size=24)] struct PropVariant {[FieldOffset(0)]public ushort vt;[FieldOffset(8)]public uint size;[FieldOffset(16)]public IntPtr data;}
[ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IAudioClient {
 void Initialize(int shareMode,uint flags,long bufferDuration,long periodicity,ref WaveFormat format,IntPtr sessionGuid);
 void GetBufferSize(out uint frames);void GetStreamLatency(out long latency);void GetCurrentPadding(out uint padding);[PreserveSig]int IsFormatSupported(int mode,ref WaveFormat format,out IntPtr closest);void GetMixFormat(out IntPtr format);void GetDevicePeriod(out long normal,out long minimum);
 void Start();void Stop();void Reset();void SetEventHandle(IntPtr handle);void GetService(ref Guid iid,[MarshalAs(UnmanagedType.IUnknown)]out object service);
}
[ComImport, Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IAudioCaptureClient {
 void GetBuffer(out IntPtr data,out uint frames,out uint flags,out ulong devicePosition,out ulong counterPosition);void ReleaseBuffer(uint frames);void GetNextPacketSize(out uint frames);
}
[ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IActivateAudioInterfaceAsyncOperation {void GetActivateResult(out int result,[MarshalAs(UnmanagedType.IUnknown)]out object audioInterface);}
[ComVisible(true), Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IActivateAudioInterfaceCompletionHandler {[PreserveSig]int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation);}
[ComVisible(true), Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IAgileObject {}
[ComVisible(true),ClassInterface(ClassInterfaceType.None)] public class Activation : IActivateAudioInterfaceCompletionHandler, IAgileObject {
 public readonly ManualResetEventSlim Ready=new(); public IAudioClient? Client; public Exception? Error;
 public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation) {try{operation.GetActivateResult(out int result,out object audio);Marshal.ThrowExceptionForHR(result);Client=(IAudioClient)audio;}catch(Exception e){Error=e;}finally{Ready.Set();}return 0;}
}
static class Native {
 [DllImport("Mmdevapi.dll",CharSet=CharSet.Unicode,ExactSpelling=true)] public static extern int ActivateAudioInterfaceAsync(string devicePath,ref Guid iid,ref PropVariant activation, IActivateAudioInterfaceCompletionHandler handler,out IActivateAudioInterfaceAsyncOperation operation);
 public static void Release(object? obj){if(obj!=null&&Marshal.IsComObject(obj))Marshal.ReleaseComObject(obj);}
}
