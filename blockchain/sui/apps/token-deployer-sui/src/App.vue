<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import WalletBar from './components/WalletBar.vue'
import ConfigForm from './components/ConfigForm.vue'
import ReviewPanel from './components/ReviewPanel.vue'
import DeployProgress from './components/DeployProgress.vue'
import ResultPanel from './components/ResultPanel.vue'
import TermsDialog from './components/TermsDialog.vue'
import { emptyForm, toTokenConfig } from './lib/form.js'
import { validateForm, isValid } from './lib/validation.js'
import { deployToken } from './lib/deploy.js'
import type { DeployStep } from './lib/deploy.js'
import { useWallet } from './composables/useWallet.js'
import AppNotice from './components/AppNotice.vue'
import { FEE_MIST, FEE_TREASURY, PUBLISH_GAS_BUDGET, isFeeConfigured } from './config.js'
import { extractErrorMessage } from './lib/errors.js'
import type { Network, PublishResult } from './lib/types.js'

type Step = 'form' | 'review' | 'deploying' | 'done'

const { account, buildExecutor } = useWallet()

const form = reactive(emptyForm())
const network = ref<Network>('testnet')
const step = ref<Step>('form')
const deployStep = ref<DeployStep | null>(null)
const deployError = ref<string | null>(null)
const result = ref<PublishResult | null>(null)

const errors = computed(() => validateForm(form))
const config = computed(() => toTokenConfig(form))
const connected = computed(() => Boolean(account.value))
const canProceed = computed(() => isValid(errors.value) && connected.value)

const termsAccepted = ref(localStorage.getItem('sui-deployer:terms-accepted') === '1')
const showTerms = ref(false)

function goReview(): void {
  if (!canProceed.value) return
  if (!termsAccepted.value) { showTerms.value = true; return }
  step.value = 'review'
}

function onTermsAccept(): void {
  localStorage.setItem('sui-deployer:terms-accepted', '1')
  termsAccepted.value = true
  showTerms.value = false
  step.value = 'review'
}

function onTermsCancel(): void {
  showTerms.value = false
}

async function confirmDeploy(): Promise<void> {
  const sender = account.value?.address
  if (!sender) {
    deployError.value = 'Connect a wallet first.'
    return
  }
  deployError.value = null
  step.value = 'deploying'
  deployStep.value = null
  try {
    // Only charge the fee when a real treasury is configured; otherwise skip it
    // rather than burn it to the zero address.
    const feeConfigured = isFeeConfigured(network.value)
    result.value = await deployToken({
      config: config.value,
      network: network.value,
      sender,
      feeMist: feeConfigured ? FEE_MIST : 0n,
      feeTreasury: FEE_TREASURY[network.value],
      gasBudget: PUBLISH_GAS_BUDGET,
      executor: await buildExecutor(network.value),
      onStep: (s) => (deployStep.value = s),
    })
    step.value = 'done'
  } catch (e) {
    deployError.value = extractErrorMessage(e)
    step.value = 'review'
  }
}

function restart(): void {
  result.value = null
  deployError.value = null
  step.value = 'form'
}
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <main id="main-content">
    <header v-once>
      <h1>Create your own Sui coin</h1>
      <p class="lede">
        Deploy a coin on Sui directly from your browser. Your wallet signs and pays gas — nothing is
        compiled or signed on a server — and you keep the full, verifiable source package.
      </p>
    </header>

    <WalletBar v-model:network="network" />

    <ConfigForm
      v-if="connected && step === 'form'"
      :form="form"
      :errors="errors"
      :can-proceed="canProceed"
      :network="network"
      :connected="connected"
      @submit="goReview"
    />

    <ReviewPanel
      v-if="connected && step === 'review'"
      :config="config"
      :network="network"
      @back="step = 'form'"
      @confirm="confirmDeploy"
    />

    <DeployProgress v-if="connected && step === 'deploying'" :step="deployStep" />

    <ResultPanel
      v-if="connected && step === 'done' && result"
      :result="result"
      :config="config"
      @restart="restart"
    />

    <AppNotice v-if="deployError" type="error">{{ deployError }}</AppNotice>

    <TermsDialog :open="showTerms" @accept="onTermsAccept" @cancel="onTermsCancel" />

    <footer v-once style="margin-top: 3rem; color: var(--muted); font-size: 0.9rem">
      <p>
        Client-side token deployment. This tool never takes custody of your token or keys. Symbol,
        name, and decimals are permanent once published.
      </p>
      <p>
        <strong>No endorsement.</strong> This is a neutral, self-serve tool. It does not review,
        verify, or endorse any token created with it, nor its creator. A token existing here implies
        nothing about its legitimacy or value — always do your own research before acquiring or
        trading any coin.
      </p>
    </footer>
  </main>
</template>
