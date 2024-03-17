import {DuploConfig, DuploInstance, Request, zod} from "@duplojs/duplojs";
import {Spec as SwaggerSchemaSpec, Response as SwaggerSchemaResponse, Operation as SwaggerSchemaOperation, Schema} from "swagger-schema-official";
import {extendZodWithOpenApi, generateSchema} from "@anatine/zod-openapi";
import {IHaveSentThis} from "@duplojs/what-was-sent";

import packageJson from "../package.json";
import indexHtml from "./index.html";
import {readFileSync, writeFileSync} from "fs";
import {SwaggerDeprecated, SwaggerDescription, SwaggerIgnore, SwaggerOperation, SwaggerParameter, SwaggerResponses, SwaggerSchemes, SwaggerTag} from "./descriptors";
import {findDescriptor} from "./findDescriptor";

export * from "./descriptors";
import * as descriptors from "./descriptors";

declare module "@duplojs/duplojs" {
	interface Plugins {
		"@duplojs/swagger": {version: string},
	}
}

declare module "@duplojs/what-was-sent" {
	interface IHaveSentThis {
		describe(description: string): this;
		description?: string; 
	}
}

type DeepPartial<T extends Record<any, any>> = {
	[P in keyof T]?: T[P] extends Record<any, any> ? DeepPartial<T[P]> : T[P]
};

export interface duploSwaggerOptions {
	outputFile?: string;
	pathDoc?: string;
	pathSwaggerFile?: string;
	index?: string;
	swaggerSpec?: DeepPartial<SwaggerSchemaSpec>;
	disabledDoc?: boolean;
	enabledDocOptionsRoute?: boolean;
	globals?: boolean;
}

export default function duploSwagger(
	instance: DuploInstance<DuploConfig>, 
	{
		outputFile = "swagger.json",
		pathDoc = "/swagger",
		pathSwaggerFile = "/swagger.json",
		index,
		swaggerSpec = {},
		disabledDoc = false,
		enabledDocOptionsRoute = false,
		globals: enabledGlobals = false,
	}: duploSwaggerOptions = {}
){
	instance.plugins["@duplojs/swagger"] = {version: packageJson.version};
	extendZodWithOpenApi(zod);

	if(instance.plugins["@duplojs/what-was-sent"]){
		IHaveSentThis.prototype.describe = function(description){
			this.description = description;
			return this;
		};
	}

	if(enabledGlobals){
		Object.entries(descriptors).forEach(([key, value]) => {
			//@ts-ignore
			global[key] = value;
		});
	}

	if(disabledDoc === false){
		const stringIndexHtml = index ? readFileSync(index, "utf-8") : indexHtml(pathSwaggerFile);
		instance.declareRoute(
			"GET", 
			pathDoc, 
			new SwaggerIgnore()
		)
		.handler(({}, res) => {
			res.code(200).setHeader("content-type", "text/html").send(stringIndexHtml);
		});

		instance.declareRoute(
			"GET", 
			pathSwaggerFile, 
			new SwaggerIgnore()
		)
		.handler(({}, res) => {
			res.code(200).setHeader("content-type", "application/json").sendFile(outputFile);
		});
	}

	if(process.argv.includes("--swagger")){
		const swagger: SwaggerSchemaSpec = {
			...swaggerSpec,

			info: {
				title: "swagger",
				version: "3.0.0",
				...swaggerSpec.info
			},
			swagger: swaggerSpec.swagger || "2.0",
			paths: {
				...swaggerSpec.paths as SwaggerSchemaSpec["paths"]
			}
		};

		instance.addHook("beforeBuildRouter", () => {
			Object.entries(instance.routes).forEach(([method, routes]) => {
				if(method === "OPTIONS" && !enabledDocOptionsRoute){
					return;
				}
				
				routes.forEach(route => {
					const descriptors: any[] = [];
					findDescriptor(route, descriptors);
					
					const ignore: boolean = !!descriptors.find(v => v instanceof SwaggerIgnore);
					if(ignore){
						return;
					}

					if(instance.plugins["@duplojs/what-was-sent"]){
						const findedIHaveSentThis: IHaveSentThis[] = descriptors.filter(desc => desc instanceof IHaveSentThis);
						findedIHaveSentThis.forEach(value => {
							descriptors.push(
								new SwaggerResponses({
									code: value.code,
									description: value.description || "",
									//@ts-ignore
									schema: {
										...generateSchema(value.zod)
									},
									info: value.info
								})
							);
						});
					}

					const parameters: SwaggerParameter[] = descriptors.filter(desc => desc instanceof SwaggerParameter);
					const schemes: SwaggerSchemes[] = descriptors.filter(desc => desc instanceof SwaggerSchemes);
					const tags: SwaggerTag[] = descriptors.filter(desc => desc instanceof SwaggerTag);
					const responses: SwaggerResponses[] = descriptors.filter(v => v instanceof SwaggerResponses) as any;
					const descriptions: SwaggerDescription[] = descriptors.filter(v => v instanceof SwaggerDescription) as any;
					const deprecated: boolean = !!descriptors.find(v => v instanceof SwaggerDeprecated);
					const operations: SwaggerOperation[] = descriptors.filter(v => v instanceof SwaggerOperation) as any;

					route.paths.forEach(path => {
						if(!swagger.paths[path]){
							swagger.paths[path] = {};
						}
		
						swagger.paths[path][route.method.toLowerCase() as Lowercase<Request["method"]>] = {
							responses: responses.reduce<Record<string, SwaggerSchemaResponse>>(
								(pv, cv) => {
									if(!pv[cv.code]){
										const responsesGroupByCode = responses.filter(v => v.code === cv.code);
										const responsesInfo: string[] = responsesGroupByCode.map(v => v.info).flat(1);

										const schemas: any[] = responsesGroupByCode
										.map(v => v.value.schema)
										.filter(v => !!v && Object.keys(v).length !== 0);

										pv[cv.code] = {
											...responsesGroupByCode.reduce((pv, cv) => ({...pv, ...cv.value}), {}),
											description: responsesGroupByCode
											.map(v => v.value.description)
											.join("\n")
											.trim(),
											schema: schemas.length === 0 ? undefined : {allOf: schemas},
											examples: responsesGroupByCode.reduce<Record<any, any>>(
												(pv, cv, index) => {
													if(cv.value.examples){
														pv[`${index}`] =  cv.value.examples;
													}

													return pv;
												},
												{}
											),
											headers: {
												...responsesGroupByCode.reduce((pv, cv) => ({...pv, ...cv.value.headers}), {}),
												//@ts-ignore
												info: responsesInfo.length !== 0 
												 	? {
														type: "string",
														description: responsesInfo.join(" | ")
													}
													: undefined,
											}, 
										};
									}

									return pv;
								}, 
								{}
							),
							parameters: parameters.map(v => v.value),
							tags: tags.map(v => v.value),
							schemes: schemes.map(v => v.value),
							description: descriptions.map(v => v.value).join("\n"),
							deprecated: deprecated,
							...operations.reduce<Partial<SwaggerSchemaOperation>>(
								(pv, cv) => ({...pv, ...cv.value}), 
								{}
							),
						};
					});
					
				});

				
			});
		});
		
		instance.addHook("beforeBuildRouter", () => writeFileSync(outputFile, JSON.stringify(swagger, undefined, 4)));

		if(process.argv.includes("--only-generate")){
			instance.addHook("beforeBuildRouter", () => process.exit());
		}
	}
}


