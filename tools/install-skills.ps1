param([string]$SkillHubCli = "$env:USERPROFILE/.skillhub/skills_store_cli.py")
$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'
if (!(Test-Path -LiteralPath $SkillHubCli)) { throw 'Install the SkillHub Python CLI from https://skillhub.cn/install/skillhub.md first.' }
$items = @(
 @('showapi','miniapp-single-canvas-ui-group-generator-showapi'),
 @('user_8c3c5215','miniapp-precision-control-evo'),
 @('tencent-adm','miniprogram-virtualpay-person'),
 @('user_7ffc2311','wechat-tabbar-icons'),
 @('tencent-adm','wxa-skills-generate'),
 @('tencent-adm','wxa-skills-validate')
)
foreach ($item in $items) {
 python $SkillHubCli --skip-self-upgrade --dir .agents/skills install $item[1] --namespace $item[0]
 if ($LASTEXITCODE -ne 0) { throw "Skill install failed: $($item[0])/$($item[1])" }
}
