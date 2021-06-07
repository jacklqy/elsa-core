import {Component, Event, EventEmitter, h, Host, Listen, Method, Prop, State, Watch} from '@stencil/core';
import {eventBus} from '../../../../services/event-bus';
import {EventTypes, WebhookDefinition, WebhookModel} from "../../../../models/webhook";
import {createElsaClient, SaveWebhookDefinitionRequest} from "../../../../services/elsa-client";
import state from '../../../../utils/store';
import {RouterHistory} from '@stencil/router';
import Tunnel, {WebhookEditorState} from '../../../../data/webhook-editor';
import {checkBox, FormContext, selectField, SelectOption, textArea, textInput} from "../../../../utils/forms";

@Component({
  tag: 'elsa-webhook-definition-editor-screen',
  shadow: false,
})
export class ElsaWebhookDefinitionEditorScreen {

  @Prop() webhookDefinition: WebhookDefinition;
  @Prop({attribute: 'webhook-definition-id', reflect: true}) webhookId: string;
  @Prop({attribute: 'server-url', reflect: true}) serverUrl: string;
  @Prop() history?: RouterHistory;
  @State() webhookDefinitionInternal: WebhookDefinition;
  @State() saving: boolean;
  @State() saved: boolean;
  @State() networkError: string;
  formContext: FormContext;
  el: HTMLElement;

  @Method()
  async getServerUrl(): Promise<string> {
    return this.serverUrl;
  }

  @Method()
  async getWebhookId(): Promise<string> {
    return this.webhookDefinitionInternal.id;
  }

  @Watch('webhookDefinition')
  async webhookDefinitionChangedHandler(newValue: WebhookDefinition) {


    this.webhookDefinitionInternal = {...newValue};
    this.formContext = new FormContext(this.webhookDefinitionInternal, newValue => this.webhookDefinitionInternal = newValue);
  }

  @Watch('webhookId')
  async webhookIdChangedHandler(newValue: string) {    
    
    const webhookId = newValue;
    let webhookDefinition: WebhookDefinition = ElsaWebhookDefinitionEditorScreen.createWebhookDefinition();
    webhookDefinition.id = webhookId;    
    const client = createElsaClient(this.serverUrl);

    if (webhookId && webhookId.length > 0) {
      try {
        webhookDefinition = await client.webhookDefinitionsApi.getByWebhookId(webhookId);
      } catch {
        console.warn(`The specified webhook definition does not exist. Creating a new one.`)
      }
    }
    else
    {
      webhookDefinition.isEnabled = true;
    }

    this.updateWebhookDefinition(webhookDefinition);
  }

  @Watch("serverUrl")
  async serverUrlChangedHandler(newValue: string) {
  }

  async componentWillLoad() {
    await this.serverUrlChangedHandler(this.serverUrl);
    await this.webhookDefinitionChangedHandler(this.webhookDefinition);
    await this.webhookIdChangedHandler(this.webhookId);
  }

  async saveWebhook() {
    
    if (!this.serverUrl || this.serverUrl.length == 0)
      return;

    const client = createElsaClient(this.serverUrl);
    
    let webhookDefinition = this.webhookDefinitionInternal;

    const request: SaveWebhookDefinitionRequest = {
      id: webhookDefinition.id || this.webhookId,      
      name: webhookDefinition.name,
      path: webhookDefinition.path,
      description: webhookDefinition.description,
      payloadTypeName: webhookDefinition.payloadTypeName,
      isEnabled: webhookDefinition.isEnabled,
    };

    this.saving = true;

    try {
      debugger
      webhookDefinition = await client.webhookDefinitionsApi.save(request);

      this.saving = false;
      this.saved = true;
      //this.webhookDefinitionInternal = webhookDefinition;
      setTimeout(() => this.saved = false, 500);
    } 
    catch (e) {
      console.error(e);    
      this.saving = false;
      this.saved = false;
      this.networkError = e.message;
      setTimeout(() => this.networkError = null, 10000);
    }
  }

  updateWebhookDefinition(value: WebhookDefinition) {
    this.webhookDefinition = value;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async onSaveClicked(e: Event) {    
    e.preventDefault();
    
    await this.saveWebhook();
    eventBus.emit(EventTypes.WebhookSaved, this, this.webhookDefinitionInternal);    
    this.sleep(1000).then(() => { this.history.push(`/webhook-definitions`, {}); });
  } 

  render() {

    return (
      <Host class="elsa-flex elsa-flex-col elsa-w-full" ref={el => this.el = el}>
        
          <form onSubmit={e => this.onSaveClicked(e)}>
            <div class="elsa-px-8 mb-8">
              <div class="elsa-border-b elsa-border-gray-200">
              </div>
            </div>

            {this.renderWebhookFields()}
            {this.renderCanvas()}

            <div class="elsa-pt-5">
              <div class="elsa-px-4 elsa-py-3 sm:elsa-px-6 sm:elsa-flex sm:elsa-flex-row-reverse">
                <button type="submit"
                        class="elsa-ml-0 elsa-w-full elsa-inline-flex elsa-justify-center elsa-rounded-md elsa-border elsa-border-transparent elsa-shadow-sm elsa-px-4 elsa-py-2 elsa-bg-blue-600 elsa-text-base elsa-font-medium elsa-text-white hover:elsa-bg-blue-700 focus:elsa-outline-none focus:elsa-ring-2 focus:elsa-ring-offset-2 focus:elsa-ring-blue-500 sm:elsa-ml-3 sm:elsa-w-auto sm:elsa-text-sm">
                  Save
                </button>
              </div>
            </div>
          </form>
        
      </Host>
    );
  }

  renderWebhookFields() {
        
    const webhookDefinition = this.webhookDefinitionInternal;
    const formContext = this.formContext;

    return (
      <div class="elsa-flex elsa-px-8">
        <div class="elsa-space-y-8 elsa-w-full">
          {textInput(formContext, 'name', 'Name', webhookDefinition.name, 'The name of the webhook.', 'webhookName')}
          {textInput(formContext, 'path', 'Path', webhookDefinition.path, 'The path of the webhook.', 'webhookPath')}
          {textArea(formContext, 'description', 'Description', webhookDefinition.description, null, 'webhookDescription')}
          {textInput(formContext, 'payloadTypeName', 'Payload Type Name', webhookDefinition.payloadTypeName, 'The payload type name of the webhook.', 'webhookPayloadTypeName')}
          {checkBox(formContext, 'isEnabled', 'Enabled', webhookDefinition.isEnabled, null)}
        </div>
      </div>
    );
  }

  renderCanvas() {

    return (
      <div class="elsa-flex-1 elsa-flex elsa-relative">
        <elsa-webhook-definition-editor-notifications/>
        <div class="elsa-fixed elsa-bottom-10 elsa-right-12">
          <div class="elsa-flex elsa-items-center elsa-space-x-4">
            {this.renderSavingIndicator()}
            {this.renderNetworkError()}
          </div>
        </div>
      </div>
    );
  }  

  renderSavingIndicator() {

    const message =
      this.saving ? 'Saving...' : this.saved ? 'Saved'
        : null;

    if (!message)
      return undefined;

    return (
      <div>
        <span class="elsa-text-gray-400 elsa-text-sm">{message}</span>
      </div>
    );
  }

  renderNetworkError() {
    if (!this.networkError)
      return undefined;

    return (
      <div>
        <span class="elsa-text-rose-400 elsa-text-sm">An error occurred: {this.networkError}</span>
      </div>);
  }

  private static createWebhookDefinition(): WebhookDefinition {
    return {
      id: null,
    };
  }
}
