import PocketBase from "pocketbase";
import { BackendModule, InitOptions, Services } from "i18next";
import { arrayToObject } from "utilities";

/**
 * A function that creates a PocketBase collection schema
 * @param languages - The languages that are being loaded
 * @param namespace - The namespace that is being loaded
 * @param key - The key that is being loaded
 * @param value - The value that is being loaded
 * @returns An array of PocketBase collection schema objects
 */
export type CollectionSchemaCreator = (
  languages: readonly string[],
  namespace: string,
  key: string,
  value: string
) => Array<{
  name: string;
  required: boolean;
  type: string;
  unique: boolean;
}>;

/**
 * A function that creates a PocketBase resource data object
 * @param language - The language that is being loaded
 * @param namespace - The namespace that is being loaded
 * @param key - The key that is being loaded
 * @param value - The value that is being loaded
 * @returns A PocketBase resource data object
 */
export type ResourceDataCreator = (
  language: string,
  namespace: string,
  key: string,
  value: string
) => Record<string, string | number | boolean>;

export type PocketBaseI18NextBackendOptions = {
  collectionSchemaCreator?: CollectionSchemaCreator;
  pocketbaseUrl?: string;
  pocketbaseAdminName?: string;
  pocketbaseAdminPassword?: string;
  refetchInterval?: number;
  resourceDataCreator?: ResourceDataCreator;
};

export class PocketBaseI18NextBackend implements BackendModule {
  public static type = "backend";

  public type = "backend" as const;

  private services: Services | undefined;

  private backendOptions: PocketBaseI18NextBackendOptions = {};

  private i18nextOptions: InitOptions = {};

  private collectionSchemaCreator: CollectionSchemaCreator = () => [
    {
      name: "key",
      required: true,
      type: "text",
      unique: true,
    },
    {
      name: "translation",
      required: true,
      type: "text",
      unique: false,
    },
  ];

  private resourceDataCreator: ResourceDataCreator = (
    language,
    namespace,
    key,
    value
  ) => ({
    key,
    translation: value,
  });

  private translationsCache: Record<string, Record<string, string>> = {};

  private _pb: PocketBase | undefined;

  private get pb() {
    if (!this._pb) {
      if (!this.backendOptions.pocketbaseUrl) {
        throw new Error("PocketBaseI18NextBackend: PocketBase URL is required");
      }

      this._pb = new PocketBase(this.backendOptions.pocketbaseUrl);
    }

    return this._pb;
  }

  private async authToPocketBase() {
    const { pocketbaseAdminPassword, pocketbaseAdminName } =
      this.backendOptions;

    if (!pocketbaseAdminName || !pocketbaseAdminPassword) {
      throw new Error(
        "PocketBaseI18NextBackend: PocketBase username and password are required"
      );
    }

    this.pb.admins.authWithPassword(
      pocketbaseAdminName,
      pocketbaseAdminPassword
    );
  }

  private async refetchTranslations() {
    await Promise.all(
      Object.keys(this.translationsCache).map(async (collectionName) => {
        const resp = await this.pb
          .collection(collectionName)
          .getFullList(undefined, { $autoCancel: false });

        const translations = arrayToObject(
          resp,
          (resource) => resource.key,
          (resource) => resource.translation
        );

        this.translationsCache[collectionName] = translations;
      })
    );
  }

  public async init(
    services: Services,
    backendOptions: PocketBaseI18NextBackendOptions,
    i18nextOptions: InitOptions
  ) {
    this.services = services;
    this.backendOptions = backendOptions;
    this.i18nextOptions = i18nextOptions;

    if (backendOptions.collectionSchemaCreator) {
      this.collectionSchemaCreator = backendOptions.collectionSchemaCreator;
    }

    if (backendOptions.resourceDataCreator) {
      this.resourceDataCreator = backendOptions.resourceDataCreator;
    }

    if (!backendOptions.pocketbaseUrl) {
      throw new Error("PocketBaseI18NextBackend: PocketBase URL is required");
    }

    if (backendOptions.refetchInterval) {
      setInterval(
        () => this.refetchTranslations(),
        backendOptions.refetchInterval
      );
    }

    this._pb = new PocketBase(backendOptions.pocketbaseUrl);

    await this.authToPocketBase();
  }

  /** Load a translation */
  public async read(language: string, namespace: string) {
    const collectionName = `${language}_${namespace}`;

    let translations: Record<string, string>;

    if (!this.translationsCache[collectionName]) {
      const resp = await this.pb
        .collection(collectionName)
        .getFullList(undefined, { $autoCancel: false });

      translations = arrayToObject(
        resp,
        (resource) => resource.key,
        (resource) => resource.translation
      );

      this.translationsCache[collectionName] = translations;
    }

    translations = this.translationsCache[collectionName];

    return translations;
  }

  /** Save the missing translation */
  async create?(
    languages: readonly string[],
    namespace: string,
    key: string,
    value = key
  ) {
    for (const language of languages) {
      const collectionName = `${language}_${namespace}`;

      const collections = await this.pb.collections.getFullList(undefined, {
        $autoCancel: false,
      });

      const targetCollection = collections.find((collection) => {
        return collection.name === collectionName;
      });

      if (!targetCollection) {
        await this.pb.collections.create(
          {
            name: collectionName,
            schema: this.collectionSchemaCreator(
              languages,
              namespace,
              key,
              value
            ),
            type: "base",
          },
          { $autoCancel: false }
        );
      }

      const data = this.resourceDataCreator(language, namespace, key, value);

      await this.pb
        .collection(collectionName)
        .create(data, { $autoCancel: false });
    }
  }

  // /** Load multiple languages and namespaces. For backends supporting multiple resources loading */
  // readMulti?(
  //   languages: readonly string[],
  //   namespaces: readonly string[],
  //   callback: MultiReadCallback
  // ): void {};

  // /** Store the translation. For backends acting as cache layer */
  // save?(language: string, namespace: string, data: ResourceLanguage): void {}
}

export default PocketBaseI18NextBackend;
