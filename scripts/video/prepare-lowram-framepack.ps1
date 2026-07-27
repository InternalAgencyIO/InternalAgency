param(
  [Parameter(Mandatory = $true)]
  [string]$ServerRoot
)

$ErrorActionPreference = "Stop"
$source = Join-Path $ServerRoot "demo_gradio.py"
$target = Join-Path $ServerRoot "demo_gradio_lowram.py"

if (-not (Test-Path -LiteralPath $source)) {
  throw "Official FramePack entrypoint not found: $source"
}

$content = Get-Content -LiteralPath $source -Raw
$replacements = [ordered]@{
  'text_encoder = LlamaModel.from_pretrained("hunyuanvideo-community/HunyuanVideo", subfolder=''text_encoder'', torch_dtype=torch.float16).cpu()' =
    'text_encoder = LlamaModel.from_pretrained("hunyuanvideo-community/HunyuanVideo", subfolder=''text_encoder'', torch_dtype=torch.float16, low_cpu_mem_usage=True).to(dtype=torch.float8_e4m3fn).cpu()'
  'transformer = HunyuanVideoTransformer3DModelPacked.from_pretrained(''lllyasviel/FramePackI2V_HY'', torch_dtype=torch.bfloat16).cpu()' =
    'transformer = HunyuanVideoTransformer3DModelPacked.from_pretrained(''lllyasviel/FramePackI2V_HY'', torch_dtype=torch.float8_e4m3fn, low_cpu_mem_usage=True).cpu()'
  'transformer.to(dtype=torch.bfloat16)' = '# transformer remains FP8 in CPU storage and casts per active layer'
  'text_encoder.to(dtype=torch.float16)' = '# text encoder remains FP8 in CPU storage and casts per active layer'
  'DynamicSwapInstaller.install_model(transformer, device=gpu)' =
    'DynamicSwapInstaller.install_model(transformer, device=gpu, dtype=torch.bfloat16)'
  'DynamicSwapInstaller.install_model(text_encoder, device=gpu)' =
    "DynamicSwapInstaller.install_model(text_encoder, device=gpu, dtype=torch.float16)`n    DynamicSwapInstaller._uninstall_module(transformer.proj_out)`n    DynamicSwapInstaller._install_module(transformer.proj_out, device=gpu, dtype=torch.float32)"
  'llama_vec = llama_vec.to(transformer.dtype)' = 'llama_vec = llama_vec.to(torch.bfloat16)'
  'llama_vec_n = llama_vec_n.to(transformer.dtype)' = 'llama_vec_n = llama_vec_n.to(torch.bfloat16)'
  'clip_l_pooler = clip_l_pooler.to(transformer.dtype)' = 'clip_l_pooler = clip_l_pooler.to(torch.bfloat16)'
  'clip_l_pooler_n = clip_l_pooler_n.to(transformer.dtype)' = 'clip_l_pooler_n = clip_l_pooler_n.to(torch.bfloat16)'
  'image_encoder_last_hidden_state = image_encoder_last_hidden_state.to(transformer.dtype)' =
    'image_encoder_last_hidden_state = image_encoder_last_hidden_state.to(torch.bfloat16)'
}

foreach ($replacement in $replacements.GetEnumerator()) {
  if (-not $content.Contains($replacement.Key)) {
    throw "FramePack source changed; low-RAM patch target was not found: $($replacement.Key)"
  }
  $content = $content.Replace($replacement.Key, $replacement.Value)
}

Set-Content -LiteralPath $target -Value $content -Encoding UTF8
Write-Output "Prepared $target"
